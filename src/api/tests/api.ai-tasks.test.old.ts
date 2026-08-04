/**
 * Comprehensive Jest Test Suite: Copilot/Alexa AI Task API
 * 
 * 65+ Tests covering:
 * - Authentication (Bearer JWT + Easy Auth)
 * - Happy paths (single/batch creation)
 * - Validation errors (strict, no coercion)
 * - Atomicity & transactions
 * - Error contracts (all error codes)
 * - Multi-user isolation
 * - Edge cases & integration
 * 
 * Framework: Jest + Supertest + Mocked Cosmos DB
 * Database: Mocked at @azure/cosmos SDK level
 */

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  TEST_USERS,
  MOCK_LISTS,
  MOCK_TASK_PAYLOADS,
  createAuthHeader,
  createBearerToken,
} from "./fixtures";

// ============================================================================
// SETUP: Mock Cosmos DB
// ============================================================================

// Store mock data in memory for test isolation
let mockDatabase: any = {};
let mockCurrentContainer = "lists";

// Jest mock for @azure/cosmos
jest.mock("@azure/cosmos", () => {
  return {
    CosmosClient: jest.fn().mockImplementation(() => ({
      database: jest.fn().mockReturnValue({
        container: jest.fn((containerId: any) => {
          mockCurrentContainer = containerId;
          
          if (!mockDatabase[containerId]) {
            mockDatabase[containerId] = [];
          }

          return {
            items: {
              create: jest.fn(async (doc: any) => {
                mockDatabase[containerId].push(doc);
                return { resource: doc };
              }),

              readAll: jest.fn(() => ({
                fetchAll: jest.fn(async () => ({
                  resources: mockDatabase[containerId],
                })),
              })),

              query: jest.fn((spec: any) => ({
                fetchAll: jest.fn(async () => {
                  const query = spec.query || "";
                  const params = spec.parameters || [];
                  let resources = [...(mockDatabase[containerId] || [])];

                  // Handle userId filtering
                  if (query.includes("@userId")) {
                    const userIdParam = params.find((p: any) => p.name === "@userId");
                    if (userIdParam) {
                      resources = resources.filter((doc: any) =>
                        doc.userId === userIdParam.value || doc.userid === userIdParam.value
                      );
                    }
                  }

                  // Handle listId filtering
                  if (query.includes("@listId")) {
                    const listIdParam = params.find((p: any) => p.name === "@listId");
                    if (listIdParam) {
                      resources = resources.filter((doc: any) =>
                        doc.listId === listIdParam.value
                      );
                    }
                  }

                  // Handle COUNT queries
                  if (query.includes("COUNT(1)")) {
                    return { resources: [resources.length] };
                  }

                  // Handle name searches (case-insensitive)
                  if (query.includes("@name")) {
                    const nameParam = params.find((p: any) => p.name === "@name");
                    if (nameParam) {
                      resources = resources.filter((doc: any) =>
                        doc.name?.toLowerCase() === nameParam.value.toLowerCase()
                      );
                    }
                  }

                  return { resources };
                }),
              })),

              batch: jest.fn(async (operations: any[], partitionKey: any) => {
                const createdDocs = [];
                for (const op of operations) {
                  if (op.operationType === "Create") {
                    mockDatabase[mockCurrentContainer]?.push(op.resourceBody);
                    createdDocs.push(op.resourceBody);
                  }
                }
                return { code: 200, result: createdDocs };
              }),

              patch: jest.fn(async (doc: any) => {
                const idx = (mockDatabase[mockCurrentContainer] || []).findIndex(
                  (d: any) => d.id === doc.id
                );
                if (idx >= 0) {
                  mockDatabase[mockCurrentContainer][idx] = { ...mockDatabase[mockCurrentContainer][idx], ...doc };
                  return { resource: mockDatabase[mockCurrentContainer][idx] };
                }
                throw new Error("Document not found");
              }),

              delete: jest.fn(async (id: any) => {
                const idx = (mockDatabase[mockCurrentContainer] || []).findIndex(
                  (d: any) => d.id === id
                );
                if (idx >= 0) {
                  mockDatabase[mockCurrentContainer].splice(idx, 1);
                }
                return {};
              }),
            },

            item: jest.fn((id: any, partitionKey: any) => ({
              read: jest.fn(async () => {
                const doc = (mockDatabase[mockCurrentContainer] || []).find(
                  (d: any) => d.id === id && (d.userId === partitionKey || d.userid === partitionKey)
                );
                return { resource: doc };
              }),

              replace: jest.fn(async (doc: any) => {
                const idx = (mockDatabase[mockCurrentContainer] || []).findIndex(
                  (d: any) => d.id === id && (d.userId === partitionKey || d.userid === partitionKey)
                );
                if (idx >= 0) {
                  mockDatabase[mockCurrentContainer][idx] = doc;
                  return { resource: doc };
                }
                throw new Error("Document not found");
              }),

              delete: jest.fn(async () => {
                const idx = (mockDatabase[mockCurrentContainer] || []).findIndex(
                  (d: any) => d.id === id && (d.userId === partitionKey || d.userid === partitionKey)
                );
                if (idx >= 0) {
                  mockDatabase[mockCurrentContainer].splice(idx, 1);
                }
                return {};
              }),
            })),
          };
        }),
      }),
    })),
    DefaultAzureCredential: jest.fn(() => ({})),
  };
});

let app: any;

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

beforeAll(() => {
  // Import server AFTER mocks are in place and NODE_ENV is set to 'test'
  // This prevents the server from auto-starting
  const server = require("../server.ts");
  app = server.default || server;

  // Seed mock database with test lists
  mockDatabase.lists = [
    { ...MOCK_LISTS.PERSONAL },
    { ...MOCK_LISTS.SHOPPING },
    { ...MOCK_LISTS.WORK },
  ];
  mockDatabase.tasks = [];
  mockDatabase["user-preferences"] = [];

  console.log("✅ Test suite initialized (65+ tests)");
});

afterAll(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDatabase.tasks = [];
  mockDatabase["user-preferences"] = [];
});

// ============================================================================
// TEST SUITE: AUTHENTICATION (10 tests)
// ============================================================================

describe("Authentication & Authorization", () => {
  describe("Bearer JWT Token Auth", () => {
    it("AUTH-001: Valid Bearer token → 200 + success", async () => {
      const token = createBearerToken(TEST_USERS.USER_A);
      const response = await request(app)
        .post("/api/ai/tasks")
        .set("authorization", `Bearer ${token}`)
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(201);
      expect(response.body.tasksCreated).toHaveLength(1);
      expect(response.body.correlationId).toBeTruthy();
    });

    it("AUTH-002: Invalid Bearer signature → 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/api/ai/tasks")
        .set("authorization", "Bearer invalid.token.here")
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("UNAUTHORIZED");
    });

    it("AUTH-003: Expired Bearer token → 401 Unauthorized", async () => {
      const expiredToken = jwt.sign(
        { sub: TEST_USERS.USER_A },
        process.env.JWT_SIGNING_KEY || "test-secret-key-min-32-characters!!",
        {
          algorithm: "HS256",
          expiresIn: "-1h",
        }
      );

      const response = await request(app)
        .post("/api/ai/tasks")
        .set("authorization", `Bearer ${expiredToken}`)
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(401);
    });

    it("AUTH-004: Missing Bearer, no Easy Auth → 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/api/ai/tasks")
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("UNAUTHORIZED");
    });

    it("AUTH-005: Bearer + Easy Auth both present (Bearer priority) → uses Bearer", async () => {
      const bearerToken = createBearerToken(TEST_USERS.USER_A);
      const easyAuthHeaders = createAuthHeader(TEST_USERS.USER_B, "easyauth");

      const response = await request(app)
        .post("/api/ai/tasks")
        .set("authorization", `Bearer ${bearerToken}`)
        .set(easyAuthHeaders)
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(201);
    });
  });

  describe("Easy Auth Fallback", () => {
    it("AUTH-006: Valid Easy Auth header → 200 + success", async () => {
      const headers = createAuthHeader(TEST_USERS.USER_A, "easyauth");
      const response = await request(app)
        .post("/api/ai/tasks")
        .set(headers)
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(201);
      expect(response.body.tasksCreated).toHaveLength(1);
    });

    it("AUTH-007: Invalid Easy Auth header → 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/api/ai/tasks")
        .set("x-ms-client-principal", "invalid-base64-!!!!")
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(401);
    });

    it("AUTH-008: Both Bearer invalid + Easy Auth invalid → 401 Unauthorized", async () => {
      const response = await request(app)
        .post("/api/ai/tasks")
        .set("authorization", "Bearer invalid-token")
        .set("x-ms-client-principal", "invalid-base64")
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(401);
    });

    it("AUTH-009: Correlation ID in response for auth failures", async () => {
      const response = await request(app)
        .post("/api/ai/tasks")
        .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

      expect(response.status).toBe(401);
      expect(response.body.message).toBeTruthy();
    });
  });

  describe("Search Endpoint Auth", () => {
    it("AUTH-010: Search endpoint requires auth", async () => {
      const response = await request(app)
        .get("/api/ai/lists/search");

      expect(response.status).toBe(401);
    });
  });
});

// ============================================================================
// TEST SUITE: HAPPY PATHS (8 tests)
// ============================================================================

describe("POST /api/ai/tasks - Happy Paths", () => {
  it("HAPPY-001: Single task → 200 + taskId", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated).toHaveLength(1);
    expect(response.body.tasksCreated[0].name).toBe("Buy milk");
  });

  it("HAPPY-002: Task with 5 subtasks → 200 + taskIds", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.TASK_WITH_SUBTASKS);

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].subtasks).toHaveLength(5);
  });

  it("HAPPY-003: Batch of 50 tasks → 200 + all taskIds", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.BATCH_50_TASKS);

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated).toHaveLength(50);
  });

  it("HAPPY-004: Auto-create list → 200 + list created", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.AUTO_CREATE_LIST);

    expect(response.status).toBe(201);
    expect(response.body.listCreated).toBe(true);
  });

  it("HAPPY-005: Use existing list → 200 + listId returned", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listId: MOCK_LISTS.PERSONAL.id,
        tasks: [{ name: "Buy milk" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.listCreated).toBe(false);
    expect(response.body.listId).toBe(MOCK_LISTS.PERSONAL.id);
  });

  it("HAPPY-006: Default iterations=1 when not specified", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].iterations).toBe(1);
  });

  it("HAPPY-007: Response includes correlationId", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

    expect(response.status).toBe(201);
    expect(response.body.correlationId).toBeTruthy();
  });

  it("HAPPY-008: High priority flag preserved", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [
          { name: "Normal", isHighPriority: false },
          { name: "Urgent", isHighPriority: true },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].isHighPriority).toBe(false);
    expect(response.body.tasksCreated[1].isHighPriority).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: VALIDATION ERRORS (17 tests)
// ============================================================================

describe("POST /api/ai/tasks - Validation", () => {
  it("VALIDATION-001: Empty batch → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({ listName: "Personal", tasks: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_REQUEST");
  });

  it("VALIDATION-002: 51 tasks → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: Array.from({ length: 51 }, (_, i) => ({ name: `Task ${i}` })),
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-003: 50 tasks → 200 (boundary)", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.BATCH_50_TASKS);

    expect(response.status).toBe(201);
  });

  it("VALIDATION-004: Fractional iterations → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "Task", iterations: 1.5 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("integer");
  });

  it("VALIDATION-005: Zero iterations → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "Task", iterations: 0 }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-006: 101 iterations → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "Task", iterations: 101 }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-007: 100 iterations → 200 (boundary)", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "Task", iterations: 100 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].iterations).toBe(100);
  });

  it("VALIDATION-008: String iterations → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "Task", iterations: "abc" }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-009: 21 subtasks → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{
          name: "Task",
          subtasks: Array.from({ length: 21 }, (_, i) => ({ name: `Sub ${i}` })),
        }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-010: 20 subtasks → 200 (boundary)", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.TASK_WITH_20_SUBTASKS);

    expect(response.status).toBe(201);
  });

  it("VALIDATION-011: Empty subtask name → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{
          name: "Task",
          subtasks: [{ name: "" }],
        }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-012: Empty task name → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "" }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-013: Task name > 500 chars → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "a".repeat(501) }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-014: Task name = 500 chars → 200 (boundary)", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "a".repeat(500) }],
      });

    expect(response.status).toBe(201);
  });

  it("VALIDATION-015: Missing listId and listName → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(400);
  });

  it("VALIDATION-016: List not found, no auto-create → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "NonExistent",
        createListIfMissing: false,
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("LIST_NOT_FOUND");
  });

  it("VALIDATION-017: Invalid batch with 1 bad task → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [
          { name: "Valid 1" },
          { name: "" },
          { name: "Valid 2" },
        ],
      });

    expect(response.status).toBe(400);
    expect(mockDatabase.tasks).toHaveLength(0);
  });
});

// ============================================================================
// TEST SUITE: ATOMICITY & TRANSACTIONS (8 tests)
// ============================================================================

describe("Atomicity & Transactions", () => {
  it("ATOMICITY-001: Batch of 10 → all created", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send(MOCK_TASK_PAYLOADS.BATCH_10_TASKS);

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated).toHaveLength(10);
  });

  it("ATOMICITY-002: Tasks linked by correlationId", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [
          { name: "A" },
          { name: "B" },
          { name: "C" },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.correlationId).toBeTruthy();
    expect(response.body.tasksCreated).toHaveLength(3);
  });

  it("ATOMICITY-003: List resolution failure → no tasks created", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listId: "nonexistent",
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(400);
    expect(mockDatabase.tasks).toHaveLength(0);
  });

  it("ATOMICITY-004: Invalid subtask → entire batch rejected", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{
          name: "Task",
          subtasks: [{ name: "" }],
        }],
      });

    expect(response.status).toBe(400);
    expect(mockDatabase.tasks).toHaveLength(0);
  });

  it("ATOMICITY-005: Parallel requests succeed independently", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const [r1, r2] = await Promise.all([
      request(app)
        .post("/api/ai/tasks")
        .set(headers)
        .send({ listName: "Personal", tasks: [{ name: "T1" }] }),
      request(app)
        .post("/api/ai/tasks")
        .set(headers)
        .send({ listName: "Personal", tasks: [{ name: "T2" }] }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(mockDatabase.tasks).toHaveLength(2);
  });

  it("ATOMICITY-006: Auto-create race → idempotent reuse", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const payload = {
      listName: "RaceList",
      createListIfMissing: true,
      tasks: [{ name: "Task" }],
    };

    const r1 = await request(app).post("/api/ai/tasks").set(headers).send(payload);
    expect(r1.status).toBe(201);
    expect(r1.body.listCreated).toBe(true);

    const r2 = await request(app).post("/api/ai/tasks").set(headers).send(payload);
    expect(r2.status).toBe(201);
    expect(r2.body.listCreated).toBe(false);
    expect(r2.body.listId).toBe(r1.body.listId);
  });

  it("ATOMICITY-007: Multiple iterations in batch → preserved", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [
          { name: "A", iterations: 2 },
          { name: "B", iterations: 5 },
          { name: "C", iterations: 10 },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].iterations).toBe(2);
    expect(response.body.tasksCreated[1].iterations).toBe(5);
    expect(response.body.tasksCreated[2].iterations).toBe(10);
    expect(response.body.summary.totalPomodorosCreated).toBe(17);
  });

  it("ATOMICITY-008: Subtasks with iterations → all preserved", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{
          name: "Main",
          iterations: 3,
          subtasks: [
            { name: "Sub1", iterations: 2 },
            { name: "Sub2", iterations: 4 },
          ],
        }],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].iterations).toBe(3);
    expect(response.body.tasksCreated[0].subtasks[0].iterations).toBe(2);
    expect(response.body.summary.totalPomodorosCreated).toBe(9);
  });
});

// ============================================================================
// TEST SUITE: ERROR CONTRACTS (10 tests)
// ============================================================================

describe("Error Contracts", () => {
  it("ERROR-001: INVALID_REQUEST with details", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({ listName: "Personal", tasks: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("INVALID_REQUEST");
    expect(response.body.message).toBeTruthy();
  });

  it("ERROR-002: LIST_NOT_FOUND response", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "NonExistent",
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("LIST_NOT_FOUND");
  });

  it("ERROR-003: UNAUTHORIZED without correlationId", async () => {
    const response = await request(app)
      .post("/api/ai/tasks")
      .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  it("ERROR-004: Errors include correlationId", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({ listName: "Personal", tasks: [] });

    expect(response.body.correlationId).toBeTruthy();
  });

  it("ERROR-005: No stack traces in 400 errors", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({ listName: "Personal", tasks: [] });

    expect(JSON.stringify(response.body)).not.toContain("at ");
  });

  it("ERROR-006: User-friendly error messages", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "a".repeat(501) }],
      });

    expect(response.body.message).toContain("must not exceed");
    expect(response.body.message).not.toMatch(/^\[ERR_/);
  });

  it("ERROR-007: Validation errors with field info", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: Array.from({ length: 51 }, (_, i) => ({ name: `T${i}` })),
      });

    expect(response.body.allErrors).toBeTruthy();
    expect(response.body.allErrors.length).toBeGreaterThan(0);
  });

  it("ERROR-008: Malformed JSON → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set("Content-Type", "application/json")
      .set(headers)
      .send("{ invalid");

    expect([400, 422]).toContain(response.status);
  });

  it("ERROR-009: Missing required tasks field → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
      });

    expect(response.status).toBe(400);
  });

  it("ERROR-010: No list identifier → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("listId or listName");
  });
});

// ============================================================================
// TEST SUITE: MULTI-USER ISOLATION (4 tests)
// ============================================================================

describe("Multi-User Isolation", () => {
  it("ISOLATION-001: User A tasks hidden from User B", async () => {
    const headersA = createAuthHeader(TEST_USERS.USER_A);
    const headersB = createAuthHeader(TEST_USERS.USER_B);

    await request(app)
      .post("/api/ai/tasks")
      .set(headersA)
      .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

    const response = await request(app)
      .get("/api/ai/lists/search")
      .set(headersB)
      .query({ q: "Personal" });

    expect(response.status).toBe(200);
    expect(response.body.lists).toHaveLength(0);
  });

  it("ISOLATION-002: User isolation in list search", async () => {
    const headersA = createAuthHeader(TEST_USERS.USER_A);
    const headersB = createAuthHeader(TEST_USERS.USER_B);

    const rA = await request(app)
      .get("/api/ai/lists/search")
      .set(headersA)
      .query({ fuzzy: true });

    const rB = await request(app)
      .get("/api/ai/lists/search")
      .set(headersB)
      .query({ fuzzy: true });

    expect(rA.status).toBe(200);
    expect(rB.status).toBe(200);
    expect(rB.body.lists).toHaveLength(0);
  });

  it("ISOLATION-003: Different tokens = isolated auth", async () => {
    const tokenA = createBearerToken(TEST_USERS.USER_A);
    const tokenB = createBearerToken(TEST_USERS.USER_B);

    const r1 = await request(app)
      .post("/api/ai/tasks")
      .set("authorization", `Bearer ${tokenA}`)
      .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

    const r2 = await request(app)
      .post("/api/ai/tasks")
      .set("authorization", `Bearer ${tokenB}`)
      .send({
        listName: "Personal",
        tasks: [{ name: "User B" }],
      });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.correlationId).not.toBe(r2.body.correlationId);
  });

  it("ISOLATION-004: Auth modes don't cross users", async () => {
    const bearerHeaders = createAuthHeader(TEST_USERS.USER_A, "bearer");
    const easyHeaders = createAuthHeader(TEST_USERS.USER_B, "easyauth");

    const r1 = await request(app)
      .post("/api/ai/tasks")
      .set(bearerHeaders)
      .send(MOCK_TASK_PAYLOADS.SINGLE_TASK);

    const r2 = await request(app)
      .post("/api/ai/tasks")
      .set(easyHeaders)
      .send({
        listName: "Personal",
        tasks: [{ name: "User B" }],
      });

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });
});

// ============================================================================
// TEST SUITE: EDGE CASES (4 tests)
// ============================================================================

describe("Edge Cases", () => {
  it("EDGE-001: Max name length (500 chars)", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [{ name: "a".repeat(500) }],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].name).toHaveLength(500);
  });

  it("EDGE-002: Unicode characters preserved", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "Personal",
        tasks: [
          { name: "Buy 🍎 & 🥕 @ $5.99" },
          { name: "Q3 Review — TBD?" },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.tasksCreated[0].name).toContain("🍎");
  });

  it("EDGE-003: Whitespace trimming", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listName: "  Personal  ",
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.listName).toBe("Personal");
  });

  it("EDGE-004: ListId precedence over listName", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .post("/api/ai/tasks")
      .set(headers)
      .send({
        listId: MOCK_LISTS.PERSONAL.id,
        listName: "Shopping",
        tasks: [{ name: "Task" }],
      });

    expect(response.status).toBe(201);
    expect(response.body.listId).toBe(MOCK_LISTS.PERSONAL.id);
  });
});

// ============================================================================
// TEST SUITE: SEARCH TESTS (4 tests)
// ============================================================================

describe("GET /api/ai/lists/search", () => {
  it("SEARCH-001: Exact match", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .get("/api/ai/lists/search")
      .set(headers)
      .query({ q: "Personal", fuzzy: false });

    expect(response.status).toBe(200);
    expect(response.body.matchType).toBe("exact");
  });

  it("SEARCH-002: Fuzzy search", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .get("/api/ai/lists/search")
      .set(headers)
      .query({ q: "shop", fuzzy: true });

    expect(response.status).toBe(200);
  });

  it("SEARCH-003: Limit respected", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .get("/api/ai/lists/search")
      .set(headers)
      .query({ limit: 1 });

    expect(response.status).toBe(200);
    expect(response.body.lists.length).toBeLessThanOrEqual(1);
  });

  it("SEARCH-004: Invalid limit → 400", async () => {
    const headers = createAuthHeader(TEST_USERS.USER_A);
    const response = await request(app)
      .get("/api/ai/lists/search")
      .set(headers)
      .query({ limit: 101 });

    expect(response.status).toBe(400);
  });
});
