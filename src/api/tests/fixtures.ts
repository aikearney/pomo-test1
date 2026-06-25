/**
 * Test Setup & Fixtures for AI Task API
 * 
 * Provides mock data, auth headers, and helper functions for all test suites.
 */

import { Request, Response, NextFunction } from "express";
import { expect } from "@jest/globals";

// ============================================================================
// TEST USER IDS & AUTH HEADERS
// ============================================================================

export const TEST_USERS = {
  USER_A: "test-user-a-uuid",
  USER_B: "test-user-b-uuid",
  USER_C: "test-user-c-uuid",
};

/**
 * Create a valid x-ms-client-principal header for testing
 */
export function createAuthHeader(userId: string): Record<string, string> {
  const principal = {
    userId,
    userDetails: userId,
    claims: [
      {
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        val: userId,
      },
    ],
  };

  return {
    "x-ms-client-principal": Buffer.from(JSON.stringify(principal)).toString("base64"),
    "x-ms-client-principal-id": userId,
    "x-ms-client-principal-name": `user-${userId}`,
  };
}

// ============================================================================
// MOCK LISTS
// ============================================================================

export const MOCK_LISTS = {
  PERSONAL: {
    id: "list-personal-1",
    name: "Personal",
    userId: TEST_USERS.USER_A,
    createdAt: Date.now() - 86400000, // 1 day ago
    color: "#FF5733",
    order: 1,
    pinned: false,
  },
  SHOPPING: {
    id: "list-shopping-1",
    name: "Shopping",
    userId: TEST_USERS.USER_A,
    createdAt: Date.now() - 86400000,
    color: "#33FF57",
    order: 2,
    pinned: true,
  },
  WORK: {
    id: "list-work-1",
    name: "Work",
    userId: TEST_USERS.USER_A,
    createdAt: Date.now() - 86400000,
    color: "#3357FF",
    order: 3,
    pinned: false,
  },
};

// ============================================================================
// MOCK TASK PAYLOADS (POST /api/ai/tasks)
// ============================================================================

export const MOCK_TASK_PAYLOADS = {
  /**
   * Single task, existing list
   */
  SINGLE_TASK: {
    listName: "Personal",
    tasks: [{ name: "Buy milk", iterations: 1, isHighPriority: false }],
  },

  /**
   * Batch of 10 tasks
   */
  BATCH_10_TASKS: {
    listId: "list-work-1",
    tasks: Array.from({ length: 10 }, (_, i) => ({
      name: `Task ${i + 1}`,
      iterations: (i % 5) + 1,
    })),
  },

  /**
   * Batch of 50 tasks (max allowed)
   */
  BATCH_50_TASKS: {
    listName: "BulkWork",
    createListIfMissing: true,
    tasks: Array.from({ length: 50 }, (_, i) => ({
      name: `Bulk Task ${i + 1}`,
      iterations: 1,
    })),
  },

  /**
   * Task with 5 subtasks
   */
  TASK_WITH_SUBTASKS: {
    listName: "Work",
    tasks: [
      {
        name: "Project Setup",
        iterations: 2,
        isHighPriority: false,
        subtasks: [
          { name: "Initialize repository", iterations: 1 },
          { name: "Install dependencies", iterations: 1 },
          { name: "Setup CI/CD", iterations: 2 },
          { name: "Write documentation", iterations: 1 },
          { name: "Deploy to staging", iterations: 1 },
        ],
      },
    ],
  },

  /**
   * Task with max 20 subtasks
   */
  TASK_WITH_20_SUBTASKS: {
    listName: "Epic",
    createListIfMissing: true,
    tasks: [
      {
        name: "Large Epic",
        iterations: 1,
        subtasks: Array.from({ length: 20 }, (_, i) => ({
          name: `Subtask ${i + 1}`,
          iterations: 1,
        })),
      },
    ],
  },

  /**
   * Tasks with custom iterations
   */
  CUSTOM_ITERATIONS: {
    listName: "Personal",
    tasks: [
      { name: "Review PR", iterations: 3 },
      { name: "Deploy", iterations: 5 },
      { name: "Monitor", iterations: 2 },
    ],
  },

  /**
   * Tasks with default iterations (no override)
   */
  DEFAULT_ITERATIONS: {
    listName: "Personal",
    tasks: [{ name: "Task A" }, { name: "Task B" }],
  },

  /**
   * Auto-create new list
   */
  AUTO_CREATE_LIST: {
    listName: "NewList",
    createListIfMissing: true,
    tasks: [{ name: "First task in new list" }],
  },

  /**
   * ListId takes precedence over listName
   */
  LIST_ID_PRECEDENCE: {
    listId: "list-personal-1",
    listName: "Shopping",
    tasks: [{ name: "Task in Personal, not Shopping" }],
  },

  /**
   * Batch exceeds 50 tasks (51 tasks - should fail)
   */
  BATCH_51_TASKS: {
    listName: "Personal",
    tasks: Array.from({ length: 51 }, (_, i) => ({
      name: `Task ${i + 1}`,
    })),
  },

  /**
   * Empty batch (0 tasks - should fail)
   */
  EMPTY_BATCH: {
    listName: "Personal",
    tasks: [],
  },

  /**
   * Subtasks exceed 20 (21 subtasks - should fail)
   */
  TASK_WITH_21_SUBTASKS: {
    listName: "Work",
    tasks: [
      {
        name: "Epic",
        subtasks: Array.from({ length: 21 }, (_, i) => ({
          name: `Subtask ${i + 1}`,
        })),
      },
    ],
  },

  /**
   * Task with empty name (should fail)
   */
  EMPTY_TASK_NAME: {
    listName: "Personal",
    tasks: [{ name: "" }],
  },

  /**
   * Task name exceeds 500 chars (should fail)
   */
  TASK_NAME_TOO_LONG: {
    listName: "Personal",
    tasks: [{ name: "a".repeat(501) }],
  },

  /**
   * Invalid iterations: non-integer (should fail)
   */
  INVALID_ITERATIONS_STRING: {
    listName: "Personal",
    tasks: [{ name: "Task", iterations: "abc" }],
  },

  /**
   * Invalid iterations: negative (should fail)
   */
  INVALID_ITERATIONS_NEGATIVE: {
    listName: "Personal",
    tasks: [{ name: "Task", iterations: -5 }],
  },

  /**
   * Invalid iterations: zero (should fail)
   */
  INVALID_ITERATIONS_ZERO: {
    listName: "Personal",
    tasks: [{ name: "Task", iterations: 0 }],
  },

  /**
   * Invalid iterations: > 100 (should fail)
   */
  INVALID_ITERATIONS_TOO_HIGH: {
    listName: "Personal",
    tasks: [{ name: "Task", iterations: 101 }],
  },

  /**
   * Missing listId and listName (should fail)
   */
  MISSING_LIST_IDENTIFIERS: {
    tasks: [{ name: "Task" }],
  },

  /**
   * List not found, no auto-create (should fail)
   */
  LIST_NOT_FOUND: {
    listName: "NonExistent",
    createListIfMissing: false,
    tasks: [{ name: "Task" }],
  },

  /**
   * All-or-nothing: 1 task invalid in batch of 3 (should fail all)
   */
  BATCH_WITH_INVALID_TASK: {
    listName: "Personal",
    tasks: [{ name: "Valid Task 1" }, { name: "" }, { name: "Valid Task 3" }],
  },

  /**
   * Invalid ListId (doesn't exist)
   */
  INVALID_LIST_ID: {
    listId: "nonexistent-uuid-12345",
    tasks: [{ name: "Task" }],
  },

  /**
   * Float iterations (should round)
   */
  FLOAT_ITERATIONS: {
    listName: "Personal",
    tasks: [
      { name: "Task A", iterations: 2.4 },
      { name: "Task B", iterations: 2.6 },
    ],
  },

  /**
   * Special characters in task names
   */
  SPECIAL_CHARACTERS: {
    listName: "Personal",
    tasks: [
      { name: "Buy 🍎 & 🥕 @ $5.99!" },
      { name: "Meeting: Q3 Review (3-5pm) — TBD?" },
    ],
  },

  /**
   * Whitespace trimming in listName
   */
  WHITESPACE_IN_LIST_NAME: {
    listName: "  Personal  ",
    tasks: [{ name: "Task" }],
  },

  /**
   * High priority flag
   */
  HIGH_PRIORITY_TASKS: {
    listName: "Personal",
    tasks: [
      { name: "Normal Task", isHighPriority: false },
      { name: "Urgent Task", isHighPriority: true },
    ],
  },
};

// ============================================================================
// MOCK SEARCH QUERIES (GET /api/ai/lists/search)
// ============================================================================

export const MOCK_SEARCH_QUERIES = {
  EXACT_MATCH: { q: "Shopping", fuzzy: false },
  CASE_INSENSITIVE_LOWER: { q: "shopping", fuzzy: false },
  CASE_INSENSITIVE_UPPER: { q: "SHOPPING", fuzzy: false },
  FUZZY_MATCH: { q: "shop", fuzzy: true },
  ALL_LISTS: {},
  WITH_LIMIT: { limit: 5 },
  INVALID_LIMIT_ZERO: { limit: 0 },
  INVALID_LIMIT_NEGATIVE: { limit: -5 },
  INVALID_LIMIT_TOO_HIGH: { limit: 101 },
};

// ============================================================================
// NOTE: Expected response structures moved inline to test files where expect() is available
// ============================================================================

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a complete POST /api/ai/tasks request
 */
export function buildTaskRequest(
  payload: Partial<typeof MOCK_TASK_PAYLOADS.SINGLE_TASK> = {},
  userId: string = TEST_USERS.USER_A
) {
  return {
    headers: createAuthHeader(userId),
    body: {
      listName: "Personal",
      ...payload,
    },
  };
}

/**
 * Build a complete GET /api/ai/lists/search request
 */
export function buildSearchRequest(
  query: Record<string, any> = {},
  userId: string = TEST_USERS.USER_A
) {
  return {
    headers: createAuthHeader(userId),
    query,
  };
}

/**
 * Validate that a batch of tasks was created successfully
 */
export function validateTaskBatch(
  response: any,
  expectedCount: number,
  expectedTotalPomodoros: number
) {
  expect(response.status).toBe(201);
  expect(response.body.tasksCreated).toHaveLength(expectedCount);
  expect(response.body.summary.tasksCount).toBe(expectedCount);
  expect(response.body.summary.totalPomodorosCreated).toBe(expectedTotalPomodoros);
}

/**
 * Validate error response structure
 */
export function validateErrorResponse(response: any, expectedStatus: number, expectedErrorCode: string) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body.error).toBe(expectedErrorCode);
  expect(response.body.message).toBeTruthy();
  expect(response.body.correlationId).toBeTruthy();
}

/**
 * Validate search results structure
 */
export function validateSearchResults(response: any, expectedListCount: number) {
  expect(response.status).toBe(200);
  expect(response.body.lists).toHaveLength(expectedListCount);
  expect(response.body.resultCount).toBe(expectedListCount);
  expect(response.body.matchType).toMatch(/^(exact|fuzzy|all)$/);
}
