# API Architecture: Copilot/Alexa Task Creation

**Document Status:** Design Proposal  
**Author:** Ripley (Lead Architect)  
**Date:** 2026-06-25  
**Target:** Parker (Product), Squad Engineering  

---

## Executive Summary

This document defines a unified API endpoint for Copilot/Alexa to create tasks, manage lists, and handle subtasks within the Pomodoro timer application. The design leverages existing authentication, maintains database constraints, and enables natural language intent parsing on the client side (Copilot/Alexa) while keeping the backend focused on data persistence.

---

## 1. New Endpoints Design

### 1.1 Task Creation Endpoint (AI-Optimized)

**Endpoint:** `POST /api/ai/tasks`

**Purpose:** Create one or more tasks (with optional subtasks) in a specified list, with support for list auto-creation.

**HTTP Method:** POST  
**Authentication:** Required (Azure Easy Auth via `x-ms-client-principal`)  
**Content-Type:** `application/json`

#### Request Headers
```
x-ms-client-principal: {base64-encoded-principal}
x-ms-client-principal-id: {userId}
x-ms-client-principal-name: {userName}
Content-Type: application/json
```

Optional header for analytics/logging:
```
x-ai-source: copilot | alexa | other  (default: copilot)
```

#### Request Body

```json
{
  "listId": "uuid-or-null",
  "listName": "Shopping",
  "createListIfMissing": true,
  "tasks": [
    {
      "name": "Buy milk",
      "iterations": 1,
      "isHighPriority": false,
      "subtasks": [
        {
          "name": "Check price online",
          "iterations": 1
        }
      ]
    },
    {
      "name": "Meal prep",
      "iterations": 2,
      "isHighPriority": true,
      "subtasks": []
    }
  ]
}
```

**Field Descriptions:**

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `listId` | string (UUID) | No | Must exist OR `listName` + `createListIfMissing` | If provided, `listName` is ignored |
| `listName` | string | No | 1–200 chars | Used if `listId` not provided; exact match (case-insensitive) |
| `createListIfMissing` | boolean | No | Default: `false` | If `true` + list not found, auto-create new list with this name |
| `tasks` | array | Yes | 1–50 items per request | Each task object |
| `tasks[].name` | string | Yes | 1–500 chars | Task title |
| `tasks[].iterations` | integer | No | 1–100, default: 1 | Pomodoro count |
| `tasks[].isHighPriority` | boolean | No | Default: `false` | Priority flag |
| `tasks[].subtasks` | array | No | 0–20 items per task | Nested tasks |
| `tasks[].subtasks[].name` | string | Yes (if included) | 1–500 chars | Subtask title |
| `tasks[].subtasks[].iterations` | integer | No | 1–100, default: 1 | Subtask pomodoro count |

**Validation Rules:**
- Empty task names are rejected (400).
- Batch size: 1–50 tasks per request; exceeding returns 400.
- Subtask nesting is one level only (no nested-subtasks of subtasks).
- Iterations must be positive integers; fractional values are rounded.
- If both `listId` and `listName` are provided, `listId` takes precedence and `listName` is ignored.

#### Success Response

**Status:** `201 Created`

```json
{
  "listId": "abc123",
  "listName": "Shopping",
  "listCreated": false,
  "tasksCreated": [
    {
      "id": "task-1-uuid",
      "name": "Buy milk",
      "iterations": 1,
      "isHighPriority": false,
      "subtasks": [
        {
          "id": "subtask-1-uuid",
          "name": "Check price online",
          "iterations": 1,
          "completed": false
        }
      ],
      "completed": false,
      "createdAt": 1719321600000
    },
    {
      "id": "task-2-uuid",
      "name": "Meal prep",
      "iterations": 2,
      "isHighPriority": true,
      "subtasks": [],
      "completed": false,
      "createdAt": 1719321600000
    }
  ],
  "summary": {
    "tasksCount": 2,
    "subtasksCount": 1,
    "totalPomodorosCreated": 4
  }
}
```

#### Error Responses

| Status | Code | Scenario | Example |
|--------|------|----------|---------|
| 400 | `INVALID_REQUEST` | Task name empty or missing | `{ "error": "INVALID_REQUEST", "message": "tasks[0].name is required", "field": "tasks[0].name" }` |
| 400 | `BATCH_SIZE_EXCEEDED` | >50 tasks in request | `{ "error": "BATCH_SIZE_EXCEEDED", "message": "Maximum 50 tasks per request. Received 75." }` |
| 400 | `LIST_NOT_FOUND_NO_AUTO_CREATE` | List doesn't exist + `createListIfMissing=false` | `{ "error": "LIST_NOT_FOUND", "message": "List 'Shopping' not found. Set createListIfMissing=true to auto-create.", "listName": "Shopping" }` |
| 400 | `INVALID_ITERATIONS` | Non-integer iterations | `{ "error": "INVALID_ITERATIONS", "message": "iterations must be a positive integer", "field": "tasks[0].iterations", "received": "abc" }` |
| 401 | `UNAUTHORIZED` | No valid auth header | `{ "error": "UNAUTHORIZED", "message": "Authentication required" }` |
| 403 | `FORBIDDEN` | User cannot create in this list (if future cross-user sharing) | `{ "error": "FORBIDDEN", "message": "No write permission for list 'abc123'" }` |
| 500 | `INTERNAL_ERROR` | Database/server error | `{ "error": "INTERNAL_ERROR", "message": "An unexpected error occurred. Please try again later.", "correlationId": "req-uuid" }` |

---

### 1.2 List Search/Validation Endpoint

**Endpoint:** `GET /api/ai/lists/search`

**Purpose:** Query available lists by name or retrieve all lists for the authenticated user. Enables Copilot/Alexa to confirm list existence before task creation.

**HTTP Method:** GET  
**Authentication:** Required  
**Query Parameters:**

| Parameter | Type | Default | Example |
|-----------|------|---------|---------|
| `q` | string | (optional) | `/api/ai/lists/search?q=Shopping` |
| `fuzzy` | boolean | `false` | `/api/ai/lists/search?q=shop&fuzzy=true` |
| `limit` | integer | 10 | `/api/ai/lists/search?limit=20` |

**Search Behavior:**
- **Exact Match (default):** Case-insensitive full name match. Returns list if `name` equals `q` (ignoring case).
- **Fuzzy Match (optional):** If `fuzzy=true`, uses substring matching or Levenshtein distance (TBD—recommend exact match for MVP).
- **All Lists:** If `q` is omitted, returns all user's lists, sorted by `order`, limited by `limit` parameter.

#### Success Response

**Status:** `200 OK`

```json
{
  "lists": [
    {
      "id": "abc123",
      "name": "Shopping",
      "createdAt": 1719321600000,
      "color": "#FF5733",
      "order": 1,
      "pinned": true,
      "taskCount": 5
    },
    {
      "id": "def456",
      "name": "Work",
      "createdAt": 1719221600000,
      "color": "#3366FF",
      "order": 2,
      "pinned": false,
      "taskCount": 12
    }
  ],
  "query": "Shopping",
  "matchType": "exact",
  "resultCount": 1
}
```

#### Error Responses

| Status | Code | Scenario |
|--------|------|----------|
| 401 | `UNAUTHORIZED` | No valid auth header |
| 400 | `INVALID_QUERY` | `limit` > 100 or < 1 |

---

### 1.3 Reuse Existing Endpoints (No Changes)

The existing endpoints remain unchanged to maintain backward compatibility:

- **`POST /api/lists`** — Create a new list (already supports direct call from UI)
- **`GET /api/lists/:id/tasks`** — Retrieve tasks in a list
- **`PATCH /api/tasks/:id`** — Update task (mark complete, adjust iterations, etc.)
- **`DELETE /api/tasks/:id`** — Delete task

The new `/api/ai/tasks` endpoint is a **convenience wrapper** that combines list lookup + multi-task creation in a single call, optimized for AI intent parsing.

---

## 2. Request/Response Contract

### 2.1 Unified Error Response Format

All endpoints return errors in a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "field": "tasks[0].name",
  "received": "invalid-value",
  "correlationId": "req-12345"
}
```

**Error Codes (Enum):**
```
UNAUTHORIZED
FORBIDDEN
INVALID_REQUEST
BATCH_SIZE_EXCEEDED
LIST_NOT_FOUND
LIST_NOT_FOUND_NO_AUTO_CREATE
INVALID_ITERATIONS
INVALID_PAYLOAD
INTERNAL_ERROR
RATE_LIMITED
```

### 2.2 Strict Validation Rules

**Philosophy: Reject Don't Coerce** — The backend validates input strictly. Invalid requests return 400 errors; we do NOT silently coerce values.

| Input | Behavior | Result |
|-------|----------|--------|
| `"iterations": "2"` | String provided (not integer) | **REJECT** — 400 INVALID_REQUEST |
| `"iterations": 1.5` | Float provided (not integer) | **REJECT** — 400 INVALID_ITERATIONS (rounds floats are coerced, but design doc says reject) |
| `"iterations": 0` | Zero or negative | **REJECT** — 400 INVALID_ITERATIONS (must be 1–100) |
| `"iterations": 101` | Out of range | **REJECT** — 400 INVALID_ITERATIONS (max 100) |
| `"isHighPriority": "true"` | String instead of boolean | **REJECT** — 400 INVALID_REQUEST |
| `"isHighPriority": 1` | Number instead of boolean | **REJECT** — 400 INVALID_REQUEST |
| `"name": "  "` | Whitespace-only name | **REJECT** — 400 INVALID_REQUEST (name required, non-empty) |
| `"name": ""` | Empty string | **REJECT** — 400 INVALID_REQUEST |
| `"listName": "  Shopping  "` | Leading/trailing whitespace | **TRIM** — `listName: "Shopping"` (whitespace normalization only) |
| `subtasks.length > 20` | Too many subtasks | **REJECT** — 400 INVALID_REQUEST (max 20 per task) |

**Coercion Policy:**
- Only whitespace trimming is allowed (input normalization, not validation)
- All other transformations (type coercion, rounding, etc.) are REJECTED with 400 error
- Explicit error messages indicate what was received vs. expected

**Rationale:** Strict validation prevents silent data corruption and makes client behavior predictable. Copilot/Alexa should fix parsing issues before sending to backend.

### 2.3 Request Coercion Rules (DEPRECATED — Use Strict Validation)

All successful responses follow this pattern:

```json
{
  "data": { /* resource details */ },
  "metadata": {
    "createdAt": 1719321600000,
    "requestId": "req-uuid",
    "apiVersion": "v1"
  }
}
```

For batch operations:

```json
{
  "listId": "...",
  "tasksCreated": [ /* array of task objects */ ],
  "summary": {
    "tasksCount": 10,
    "subtasksCount": 5,
    "totalPomodorosCreated": 25
  }
}
```

---

## 3. Authentication Strategy

### 3.1 Dual-Mode Authentication (Bearer Token + Easy Auth)

**Preferred Order:**
1. **Bearer Token (JWT)** — External clients (Copilot, Alexa, plugins)
2. **Azure Easy Auth** — Web app (fallback)

**Bearer Token Mode (NEW):**
- **Header:** `Authorization: Bearer {jwt-token}`
- **Validation:**
  - Token signature verification (RS256 or HS256)
  - Expiration check (`exp` claim)
  - Audience verification (`aud` claim must contain app identifier)
  - Subject extraction (`sub` or `oid` claim for user ID)
- **Token Claims Expected:**
  ```json
  {
    "sub": "user-uuid",
    "aud": "pomodoro-app",
    "exp": 1719408000,
    "iat": 1719321600,
    "email": "user@example.com"
  }
  ```
- **Configuration (env vars):**
  - `JWT_SIGNING_KEY` or `JWT_ISSUER` — for validation
  - `JWT_AUDIENCE` — expected audience claim
  - `JWT_ALGORITHMS` — allowed algorithms (default: RS256)

**Easy Auth Mode (Legacy):**
- **Header:** `x-ms-client-principal`
- **Extraction:** `getUserId()` helper (existing in `src/api/shared/auth.ts`)
- **Fallback:** Used only if Bearer token not provided

**Implementation Logic:**
```typescript
// Pseudocode
async function getAuthenticatedUserId(req) {
  // Try Bearer token first
  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    const userId = await validateJWT(bearerToken);
    if (userId) return userId; // Success
    // If token invalid, reject (don't fall back)
  }
  
  // Fall back to Easy Auth
  const easyAuthUserId = getUserId(req);
  if (easyAuthUserId) return easyAuthUserId;
  
  // No valid auth found
  return null;
}
```

**Security Note:** If Bearer token is present but invalid, the request is REJECTED (status 401). We do NOT fall back to Easy Auth on invalid Bearer tokens. This prevents auth bypass.

### 3.2 Optional Analytics Header

Add optional header for logging/metrics (does NOT affect auth):

```
x-ai-source: copilot | alexa | other
```

**Usage:**
- Log which AI system created tasks (for analytics/debugging).
- No authorization impact; purely observational.
- If omitted, defaults to `"other"`.

**Example Logging:**
```
POST /api/ai/tasks with x-ai-source: copilot
User: user-123, List: Shopping, Tasks: 2, AI Source: copilot
```

### 3.3 Rate Limiting (Future Phase 2)

**Recommendation:** Implement rate limiting after MVP launch.

**Proposed Strategy:**
- Per-user limit: **10 batch requests per minute** (adjustable).
- Per-session limit: **100 tasks per hour**.
- Return `429 Too Many Requests` if exceeded.

**For MVP:** Skip rate limiting; focus on core functionality.

---

## 4. User Intent Parsing (Client-Side Logic)

### 4.1 Parsing Strategy

**Intent parsing happens in Copilot/Alexa, NOT the backend.** The backend receives structured JSON.

**Copilot/Alexa examples → Backend payload:**

#### Example 1: "Create a task 'Buy milk' in Shopping"
```
User Input: "Create a task 'Buy milk' in Shopping"
Parsed Intent: { listName: "Shopping", tasks: [{ name: "Buy milk" }] }
Backend Call: POST /api/ai/tasks
Payload:
{
  "listName": "Shopping",
  "createListIfMissing": false,
  "tasks": [{ "name": "Buy milk", "iterations": 1 }]
}
```

#### Example 2: "Add 'Meal prep' (3 pomodoros, high priority) to Work"
```
User Input: "Add 'Meal prep' (3 pomodoros, high priority) to Work"
Parsed Intent: { listName: "Work", tasks: [{ name: "Meal prep", iterations: 3, isHighPriority: true }] }
Backend Call: POST /api/ai/tasks
Payload:
{
  "listName": "Work",
  "createListIfMissing": false,
  "tasks": [{ "name": "Meal prep", "iterations": 3, "isHighPriority": true }]
}
```

#### Example 3: "Create 'Review proposal' with subtasks 'Read doc' and 'Write feedback' in a new list called 'Project X'"
```
User Input: "Create 'Review proposal' with subtasks 'Read doc' and 'Write feedback' in a new list called 'Project X'"
Parsed Intent: 
{
  listName: "Project X",
  createListIfMissing: true,
  tasks: [{
    name: "Review proposal",
    subtasks: [
      { name: "Read doc" },
      { name: "Write feedback" }
    ]
  }]
}
Backend Call: POST /api/ai/tasks
Payload:
{
  "listName": "Project X",
  "createListIfMissing": true,
  "tasks": [{
    "name": "Review proposal",
    "iterations": 1,
    "subtasks": [
      { "name": "Read doc", "iterations": 1 },
      { "name": "Write feedback", "iterations": 1 }
    ]
  }]
}
```

### 4.2 List Name Matching

**Recommendation: Exact Match (MVP)**

- **Exact Match (default):** `listName: "Shopping"` must match an existing list's name (case-insensitive).
- **Fallback:** If exact match fails AND `createListIfMissing: true`, create new list with that name.
- **No Fuzzy Matching in MVP:** Avoids ambiguity ("Shoping" ≠ "Shopping").

**Future Enhancement (Phase 2):**
- Optionally add fuzzy matching with user confirmation ("Did you mean 'Shopping'?").
- Use `GET /api/ai/lists/search?q=Shopping&fuzzy=true` to test.

---

## 5. Transaction Guarantees & Atomicity

### 5.1 All-or-Nothing Task Creation

**Guarantee:** The `POST /api/ai/tasks` endpoint guarantees **atomic creation**. Either ALL tasks in the batch are created successfully, or NONE are created.

**Validation Phase (Synchronous):**
1. All tasks in request are validated BEFORE any database operations
2. If ANY task fails validation, the entire batch is rejected with 400 error
3. No tasks are persisted; client gets explicit error message

**Creation Phase (Transactional):**
1. After validation passes, all tasks are written to Cosmos DB in a single transaction
2. If the transaction fails (network error, Cosmos throttling, etc.):
   - All writes are rolled back (no partial data created)
   - Response: 500 `INTERNAL_ERROR` with correlation ID
   - Client should retry (request is idempotent if same `requestId` is provided)

**Important:** List creation happens BEFORE task creation. If list creation succeeds but task creation fails:
- List is already created (cannot be rolled back)
- Tasks are rolled back (not created)
- Client receives 500 error with guidance: "List '{listName}' was created, but tasks failed. Retry with `listId`."

### 5.2 Transactional Wrapper Implementation

**Pseudo-code:**
```typescript
async function createTasksAtomically(userId, listId, tasks) {
  return withTransaction(async (txn) => {
    // Write all tasks to Cosmos in single batch operation
    const createdTasks = [];
    for (const task of tasks) {
      const created = await getTasksContainer().items.create({
        ...task,
        userId,
        id: uuid(),
      });
      createdTasks.push(created);
    }
    return createdTasks;
  });
}

// Usage in endpoint:
try {
  const tasksCreated = await createTasksAtomically(userId, listId, tasks);
  // Success: all tasks written
  res.status(201).json({ tasksCreated, ... });
} catch (error) {
  if (error instanceof TransactionError) {
    res.status(500).json({ 
      error: "INTERNAL_ERROR",
      message: "Transaction failed. Please retry.",
      correlationId: requestId
    });
  }
}
```

### 5.3 Retry Behavior

**For Clients:**
- If you receive 500 `INTERNAL_ERROR`, retry the request
- To safely retry, include a `requestId` header:
  ```
  X-Request-ID: {stable-uuid}
  ```
- Backend can use this to detect duplicate requests and return cached result (idempotency, Phase 2)

**For Backend:**
- Retry logic: Exponential backoff (100ms → 500ms → 2s) on Cosmos throttling
- Max retries: 3 before returning 500 error to client
- Log all transaction failures for debugging

---

## 6. Workflow Logic & Edge Cases

### 6.1 List Creation Flow

**Scenario: User says "Add task to a new list called 'Groceries'"**

1. Copilot/Alexa parses intent:
   ```json
   {
     "listName": "Groceries",
     "createListIfMissing": true,
     "tasks": [{ "name": "Buy eggs" }]
   }
   ```

2. Backend receives request:
   - Check if list "Groceries" exists for user → **NOT FOUND**
   - Check `createListIfMissing` → `true`
   - **Auto-create** list with name "Groceries" + defaults (color: null, order: Date.now(), pinned: false)
   - Return new `listId` in response

3. Response:
   ```json
   {
     "listId": "new-uuid",
     "listName": "Groceries",
     "listCreated": true,
     "tasksCreated": [...]
   }
   ```

**Alternative: `createListIfMissing: false` (default)**

1. Copilot parses: `listName: "Groceries", createListIfMissing: false`
2. Backend: List not found → return **400 LIST_NOT_FOUND**
3. Copilot prompts user: "List 'Groceries' not found. Create it?" → User confirms → Retry with `createListIfMissing: true`

**Recommendation:** Default to `false` for safety; require explicit user confirmation to auto-create.

---

### 5.2 Subtask Handling

**Constraint:** Subtasks are one level deep (no nested subtasks).

**Valid:**
```json
{
  "name": "Review proposal",
  "subtasks": [
    { "name": "Read document" },
    { "name": "Write feedback" }
  ]
}
```

**Invalid (rejected with 400):**
```json
{
  "name": "Review proposal",
  "subtasks": [
    {
      "name": "Read document",
      "subtasks": [{ "name": "Skim abstract" }]  // ❌ NESTED SUBTASKS NOT ALLOWED
    }
  ]
}
```

**Database Structure:**
- Tasks table stores `subtasks` as a JSON array within the task document.
- Cosmos DB handles arrays natively; no separate subtasks collection needed.

---

### 5.3 Batch Creation Guarantees

**Atomicity:** Backend processes all tasks as a batch. If ANY task fails validation, the **entire batch is rejected** (400 error). No partial inserts.

**Failure Example:**
```
POST /api/ai/tasks
{
  "listId": "abc123",
  "tasks": [
    { "name": "Valid task" },
    { "name": "" },  // ❌ EMPTY NAME
    { "name": "Another valid task" }
  ]
}

Response: 400 BAD_REQUEST
{
  "error": "INVALID_REQUEST",
  "message": "tasks[1].name is required and must be non-empty",
  "field": "tasks[1].name",
  "tasksRejected": 3
}

// NO TASKS CREATED (all-or-nothing)
```

**Rationale:** Simplifies error handling; Copilot/Alexa retries entire batch after fixing validation issues.

---

### 5.4 Duplicate Task Detection

**No deduplication in backend.** If Copilot/Alexa sends the same task twice, it's created twice.

**Rationale:** 
- Reduces backend complexity.
- Copilot/Alexa is responsible for parsing and deduplication.
- User can manually delete duplicates from UI.

**Future Enhancement:** Add optional `idempotencyKey` header if needed.

---

## 6. Database Constraints & Schema

### 6.1 Tasks Collection Schema (Cosmos DB)

```typescript
interface Task {
  id: string;                    // UUID (partition key: userId)
  userId: string;                // Partition key
  listId: string;                // Foreign key to lists
  name: string;                  // 1–500 chars
  iterations: number;            // 1–100 (positive integer)
  subtasks: Subtask[];           // Array, max 20 items
  completed: boolean;
  collapsed: boolean;
  isHighPriority: boolean;
  completedIterations?: number;  // Track progress
  recurrence?: string;           // Optional recurrence rule (future)
  order?: number;                // Sort order (timestamp)
  createdAt: number;             // Milliseconds since epoch
}

interface Subtask {
  id: string;                    // UUID
  name: string;                  // 1–500 chars
  iterations: number;            // 1–100
  completed: boolean;
}
```

### 6.2 Lists Collection Schema (Cosmos DB)

```typescript
interface TaskList {
  id: string;                    // UUID (partition key: userId)
  userId: string;                // Partition key
  name: string;                  // 1–200 chars
  createdAt: number;             // Milliseconds since epoch
  color: string | null;          // Hex code or null
  order: number;                 // Sort order
  pinned: boolean;               // Pin to top
}
```

### 6.3 Database Indexes

**Ensure indexes exist for performance:**

```
tasks:
  - Partition Key: userId
  - Query: (userId, listId, createdAt DESC)
  
lists:
  - Partition Key: userId
  - Query: (userId, order ASC)
```

**Note:** Cosmos DB creates partition key index automatically. Ensure composite indexes for `(userId, listId)` queries.

---

## 7. Assumptions & Design Decisions

| # | Assumption | Rationale | Risk |
|---|-----------|-----------|------|
| 1 | Auth via existing Azure Easy Auth headers | Reuses proven auth; no new infrastructure | Low |
| 2 | Batch creation is all-or-nothing (no partial inserts) | Simplifies error handling and retry logic | Low — user retries easily |
| 3 | List name matching is exact (case-insensitive) | Avoids ambiguity in MVP | Medium — fuzzy matching deferred to Phase 2 |
| 4 | Subtasks are one level deep (no nesting) | Simplifies schema and UX | Medium — future enhancement if needed |
| 5 | No rate limiting in MVP | Reduces backend complexity; add in Phase 2 if abuse occurs | Medium — needs monitoring |
| 6 | Copilot/Alexa handles all intent parsing | Backend focuses on data layer; cleaner separation | Low — proven pattern in LLM apps |
| 7 | Default `iterations: 1` if omitted | Sensible default for quick task creation | Low |
| 8 | No duplicate task detection in backend | Copilot responsible for deduplication | Medium — users can delete duplicates manually |
| 9 | Response includes summary (task/pomodoro count) | Useful for analytics and user feedback | Low — simple to compute |
| 10 | Timestamp stored in milliseconds (Date.now()) | Standard JS/JSON convention | Low — matches existing codebase |

---

## 8. Example Workflows

### Workflow A: Simple Task in Existing List

**User:** "Alexa, add 'Call dentist' to my Personal list"

**Alexa → Backend:**
```
POST /api/ai/tasks
{
  "listName": "Personal",
  "createListIfMissing": false,
  "tasks": [{ "name": "Call dentist" }]
}
```

**Backend → Alexa:**
```json
{
  "listId": "personal-list-id",
  "listName": "Personal",
  "listCreated": false,
  "tasksCreated": [{
    "id": "task-uuid",
    "name": "Call dentist",
    "iterations": 1,
    "subtasks": [],
    "isHighPriority": false,
    "completed": false,
    "createdAt": 1719321600000
  }],
  "summary": { "tasksCount": 1, "subtasksCount": 0, "totalPomodorosCreated": 1 }
}
```

**Alexa says:** "Added 'Call dentist' to Personal list."

---

### Workflow B: Multi-Task with Subtasks in New List

**User:** "Copilot, create a new list called 'Quarterly Review'. Add task 'Self-assessment' with subtasks 'Reflect on wins' and 'Identify growth areas', 2 pomodoros."

**Copilot → Backend:**
```
POST /api/ai/tasks
{
  "listName": "Quarterly Review",
  "createListIfMissing": true,
  "tasks": [{
    "name": "Self-assessment",
    "iterations": 2,
    "subtasks": [
      { "name": "Reflect on wins" },
      { "name": "Identify growth areas" }
    ]
  }]
}
```

**Backend → Copilot:**
```json
{
  "listId": "new-uuid-123",
  "listName": "Quarterly Review",
  "listCreated": true,
  "tasksCreated": [{
    "id": "task-uuid",
    "name": "Self-assessment",
    "iterations": 2,
    "subtasks": [
      { "id": "sub-1", "name": "Reflect on wins", "iterations": 1, "completed": false },
      { "id": "sub-2", "name": "Identify growth areas", "iterations": 1, "completed": false }
    ],
    "isHighPriority": false,
    "completed": false,
    "createdAt": 1719321600000
  }],
  "summary": { "tasksCount": 1, "subtasksCount": 2, "totalPomodorosCreated": 4 }
}
```

**Copilot responds:** "Created new list 'Quarterly Review' with task 'Self-assessment' (2 pomodoros) and 2 subtasks."

---

### Workflow C: Error — List Not Found, No Auto-Create

**User:** "Copilot, add 'Review notes' to Marketing list"

**Copilot → Backend:**
```
POST /api/ai/tasks
{
  "listName": "Marketing",
  "createListIfMissing": false,
  "tasks": [{ "name": "Review notes" }]
}
```

**Backend → Copilot (400 error):**
```json
{
  "error": "LIST_NOT_FOUND",
  "message": "List 'Marketing' not found. Set createListIfMissing=true to auto-create.",
  "listName": "Marketing"
}
```

**Copilot prompts user:** "I don't see a 'Marketing' list. Would you like me to create it?"  
**User:** "Yes"

**Copilot → Backend (retry with auto-create):**
```
POST /api/ai/tasks
{
  "listName": "Marketing",
  "createListIfMissing": true,
  "tasks": [{ "name": "Review notes" }]
}
```

**Success:** Task created in new list.

---

## 9. Implementation Roadmap

### Phase 1 (MVP) — Current Sprint
- [ ] Implement `POST /api/ai/tasks` endpoint
- [ ] Implement `GET /api/ai/lists/search` endpoint
- [ ] Unit tests for batch validation
- [ ] Integration tests with Cosmos DB
- [ ] Documentation for Copilot/Alexa team
- [ ] Deploy to staging environment

### Phase 2 (Post-MVP) — Next Sprint
- [ ] Rate limiting (10 reqs/min per user)
- [ ] Fuzzy list name matching
- [ ] Idempotency support (optional `idempotencyKey` header)
- [ ] Analytics dashboard (tasks created by source: copilot vs alexa vs manual)
- [ ] Performance optimization (bulk Cosmos DB inserts)

### Phase 3 (Future)
- [ ] Support recurring tasks from voice input
- [ ] Task templates ("Create standup: [1] Review blockers [2] Plan day")
- [ ] Smart defaults based on list context
- [ ] Conflict detection (duplicate task in same list)

---

## 10. Security & Compliance

### 10.1 Authentication
- All endpoints require valid `x-ms-client-principal` header (Azure Easy Auth).
- Backend validates `userId` before querying/creating data.

### 10.2 Authorization
- Users can only create tasks in their own lists.
- Cosmos DB partition key (`userId`) ensures data isolation.
- No cross-user access possible.

### 10.3 Input Validation
- Payload size limited to 1 MB (Express middleware).
- String fields max 500 chars (tasks/subtasks) or 200 chars (list names).
- Batch size: 1–50 tasks per request.
- No SQL injection risk (Cosmos DB SDK uses parameterized queries).

### 10.4 Logging & Auditing
- Log all task creation (user ID, list ID, task count, timestamp).
- Optional `x-ai-source` header for attribution (copilot vs alexa).
- No sensitive data in logs (no task content verbatim; just counts/IDs).

---

## 11. Testing Strategy

### Unit Tests
```typescript
// src/api/__tests__/ai-tasks.test.ts
describe("POST /api/ai/tasks", () => {
  it("should create a single task in existing list", async () => { ... });
  it("should create multiple tasks with subtasks", async () => { ... });
  it("should reject empty task names", async () => { ... });
  it("should auto-create list if createListIfMissing=true", async () => { ... });
  it("should return 400 if list not found and createListIfMissing=false", async () => { ... });
  it("should reject batch > 50 tasks", async () => { ... });
  it("should coerce iterations to positive integer", async () => { ... });
  it("should require authentication", async () => { ... });
});

describe("GET /api/ai/lists/search", () => {
  it("should return all lists if no query", async () => { ... });
  it("should return exact match for list name", async () => { ... });
  it("should return empty array if no match", async () => { ... });
  it("should respect limit parameter", async () => { ... });
});
```

### Integration Tests
- Full request/response cycles with real Cosmos DB (or emulator).
- Verify created tasks appear in subsequent GET requests.
- Test cleanup (delete tasks/lists after tests).

### End-to-End Tests (with Copilot/Alexa)
- Copilot sends realistic intent payloads.
- Verify UI reflects created tasks.
- Test multi-user scenarios (different user IDs).

---

## 12. Deployment Checklist

- [ ] New endpoint code merged to `main` branch
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing on staging
- [ ] Azure Functions deployed to staging environment
- [ ] Cosmos DB indexes created (if needed)
- [ ] Rate limiting config ready (Phase 2)
- [ ] Logging/monitoring enabled (Application Insights)
- [ ] Documentation updated (API docs, Copilot/Alexa handoff docs)
- [ ] Approved by Parker (Product) and security review
- [ ] Deployed to production with canary/gradual rollout
- [ ] Monitoring alerts configured (error rates, latency)

---

## 13. Open Questions & Future Discussions

1. **Fuzzy List Matching:** Should we implement approximate string matching (e.g., "Shoping" → "Shopping") in Phase 2? Recommend: No for MVP; too risky.

2. **Task Templates:** Should Copilot/Alexa support predefined templates (e.g., "Create standup")? Recommend: Defer to Phase 3.

3. **Recurrence Rules:** Should `POST /api/ai/tasks` support recurrence (e.g., "Create weekly standup")? Recommend: Defer to Phase 2; requires complex parsing.

4. **Collaborative Lists:** If future feature allows list sharing, how should auth work? Recommend: Preemptively add `listOwnerId` check before Phase 2.

5. **Task Description Field:** Should tasks have a `description` field for voice notes? Recommend: Defer; adds complexity.

---

## Appendix A: cURL Examples

### Example 1: Create Single Task
```bash
curl -X POST http://localhost:7071/api/ai/tasks \
  -H "Content-Type: application/json" \
  -H "x-ms-client-principal-id: user-123" \
  -d '{
    "listName": "Shopping",
    "createListIfMissing": false,
    "tasks": [{ "name": "Buy milk" }]
  }'
```

### Example 2: Create Multiple Tasks with Subtasks
```bash
curl -X POST http://localhost:7071/api/ai/tasks \
  -H "Content-Type: application/json" \
  -H "x-ms-client-principal-id: user-123" \
  -d '{
    "listName": "Work",
    "createListIfMissing": true,
    "tasks": [
      {
        "name": "Prepare presentation",
        "iterations": 3,
        "isHighPriority": true,
        "subtasks": [
          { "name": "Gather data" },
          { "name": "Design slides" }
        ]
      }
    ]
  }'
```

### Example 3: Search Lists
```bash
curl -X GET "http://localhost:7071/api/ai/lists/search?q=Shopping" \
  -H "x-ms-client-principal-id: user-123"
```

---

## Appendix B: TypeScript Type Definitions

```typescript
// src/api/types/ai-tasks.ts

export interface AITaskCreateRequest {
  listId?: string;
  listName?: string;
  createListIfMissing?: boolean;  // default: false
  tasks: AITask[];
}

export interface AITask {
  name: string;
  iterations?: number;            // default: 1
  isHighPriority?: boolean;       // default: false
  subtasks?: AISubtask[];
}

export interface AISubtask {
  name: string;
  iterations?: number;            // default: 1
}

export interface AITaskCreateResponse {
  listId: string;
  listName: string;
  listCreated: boolean;
  tasksCreated: Task[];           // Full Task objects from DB
  summary: {
    tasksCount: number;
    subtasksCount: number;
    totalPomodorosCreated: number;
  };
}

export interface AIListSearchResponse {
  lists: TaskListInfo[];
  query?: string;
  matchType: "exact" | "fuzzy" | "all";
  resultCount: number;
}

export interface TaskListInfo extends TaskList {
  taskCount: number;
}

export interface APIError {
  error: string;  // Error code (enum)
  message: string;
  field?: string;
  received?: any;
  correlationId?: string;
}
```

---

## Conclusion

This design provides a clean, scalable API contract for Copilot/Alexa task creation while leveraging existing authentication, database patterns, and validation logic. The `/api/ai/tasks` endpoint abstracts list lookup and batch task creation into a single call, reducing client complexity and enabling seamless voice-driven workflows.

**Next Steps:**
1. Parker reviews and approves design.
2. Squad engineers implement Phase 1 (MVP).
3. Deploy to staging for Copilot/Alexa team integration testing.
4. Gather feedback and iterate.

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-25  
**Approved By:** (Pending Parker review)
