# Comprehensive Test Plan: Copilot/Alexa AI Task API

**Document:** Test Plan  
**APIs Under Test:** POST /api/ai/tasks, GET /api/ai/lists/search  
**Test Framework:** Jest + Supertest  
**Test Date Range:** 2026-06-25+  
**Status:** Draft – Ready for Implementation

---

## Executive Summary

This document outlines a comprehensive test strategy for the Copilot/Alexa task creation and list search endpoints. The test suite covers happy paths, error scenarios, edge cases, and integration workflows.

**Key Testing Goals:**
- Validate batch task creation (1-50 tasks)
- Verify list auto-creation and collision handling
- Ensure proper authentication and user isolation
- Test all error codes and validation rules
- Verify subtask structure and limits (1-20 per task)
- Confirm pomodoro counting accuracy
- Performance validation for large batches

---

## 1. POST /api/ai/tasks Test Cases

### 1.1 Happy Path: Single Task Creation

**Test ID:** `AI_TASKS_001`  
**Title:** Create single task in existing list

**Pre-conditions:**
- User is authenticated (valid x-ms-client-principal header)
- List "Personal" exists for the user
- Database is accessible

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {
      "name": "Buy milk",
      "iterations": 1,
      "isHighPriority": false
    }
  ]
}
```

**Expected Results:**
- Status: 201 Created
- Response contains `listId`, `listName: "Personal"`, `listCreated: false`
- `tasksCreated[0]` has: `id`, `name: "Buy milk"`, `iterations: 1`, `isHighPriority: false`
- `summary.tasksCount: 1`, `totalPomodorosCreated: 1`
- Database contains task with `userId` matching auth header
- Task is queryable via GET /api/lists/{listId}/tasks

**Assertions:**
```javascript
expect(response.status).toBe(201);
expect(response.body.listCreated).toBe(false);
expect(response.body.tasksCreated).toHaveLength(1);
expect(response.body.tasksCreated[0].name).toBe("Buy milk");
expect(response.body.summary.totalPomodorosCreated).toBe(1);
```

---

### 1.2 Happy Path: Batch Create (10 Tasks)

**Test ID:** `AI_TASKS_002`  
**Title:** Create 10 tasks in one request

**Pre-conditions:** User authenticated, list exists

**Request:**
```json
{
  "listId": "abc-123-def",
  "tasks": [
    {"name": "Task 1", "iterations": 1},
    {"name": "Task 2", "iterations": 2},
    ...
    {"name": "Task 10", "iterations": 1}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- `tasksCreated.length: 10`
- `summary.tasksCount: 10`
- `summary.totalPomodorosCreated: 12` (1+2+1+1+1+1+1+1+1+1)
- All tasks visible in subsequent GET /api/lists/{listId}/tasks

**Assertions:**
```javascript
expect(response.body.tasksCreated).toHaveLength(10);
expect(response.body.summary.tasksCount).toBe(10);
expect(response.body.summary.totalPomodorosCreated).toBe(12);
```

---

### 1.3 Happy Path: Batch Max Size (50 Tasks)

**Test ID:** `AI_TASKS_003`  
**Title:** Create exactly 50 tasks (boundary test)

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Work",
  "createListIfMissing": true,
  "tasks": [ /* 50 task objects */ ]
}
```

**Expected Results:**
- Status: 201 Created
- `tasksCreated.length: 50`
- `listCreated: true` (new list auto-created)
- All 50 tasks persisted to database

**Assertions:**
```javascript
expect(response.body.tasksCreated).toHaveLength(50);
expect(response.body.listCreated).toBe(true);
```

---

### 1.4 Happy Path: Task with Subtasks

**Test ID:** `AI_TASKS_004`  
**Title:** Create task with 5 subtasks

**Pre-conditions:** User authenticated, list exists

**Request:**
```json
{
  "listName": "Work",
  "tasks": [
    {
      "name": "Project Setup",
      "iterations": 2,
      "subtasks": [
        {"name": "Initialize repo", "iterations": 1},
        {"name": "Install dependencies", "iterations": 1},
        {"name": "Setup CI/CD", "iterations": 2},
        {"name": "Write README", "iterations": 1},
        {"name": "Deploy staging", "iterations": 1}
      ]
    }
  ]
}
```

**Expected Results:**
- Status: 201 Created
- `tasksCreated[0].subtasks.length: 5`
- Each subtask has `id`, `name`, `iterations`, `completed: false`
- `summary.subtasksCount: 5`
- `summary.totalPomodorosCreated: 8` (2 parent + 1+1+2+1+1 subtasks)

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].subtasks).toHaveLength(5);
expect(response.body.summary.subtasksCount).toBe(5);
expect(response.body.summary.totalPomodorosCreated).toBe(8);
```

---

### 1.5 Happy Path: Subtask Max Limit (20 Subtasks)

**Test ID:** `AI_TASKS_005`  
**Title:** Create task with exactly 20 subtasks (boundary)

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Epic",
  "createListIfMissing": true,
  "tasks": [
    {
      "name": "Large Epic",
      "iterations": 1,
      "subtasks": [ /* 20 subtask objects */ ]
    }
  ]
}
```

**Expected Results:**
- Status: 201 Created
- `tasksCreated[0].subtasks.length: 20`
- All subtasks stored with correct iterations

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].subtasks).toHaveLength(20);
expect(response.body.summary.subtasksCount).toBe(20);
```

---

### 1.6 Happy Path: Custom Iterations

**Test ID:** `AI_TASKS_006`  
**Title:** Create tasks with custom iterations (override default 1)

**Pre-conditions:** User authenticated, list exists

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Review PR", "iterations": 3},
    {"name": "Deploy", "iterations": 5},
    {"name": "Monitor", "iterations": 2}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- Tasks have iterations: [3, 5, 2]
- `summary.totalPomodorosCreated: 10`

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].iterations).toBe(3);
expect(response.body.tasksCreated[1].iterations).toBe(5);
expect(response.body.tasksCreated[2].iterations).toBe(2);
```

---

### 1.7 Happy Path: Default Iterations (No Override)

**Test ID:** `AI_TASKS_007`  
**Title:** Iterations default to 1 when not provided

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Task A"},
    {"name": "Task B"}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- Both tasks have `iterations: 1`
- `summary.totalPomodorosCreated: 2`

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].iterations).toBe(1);
expect(response.body.tasksCreated[1].iterations).toBe(1);
```

---

### 1.8 Happy Path: Auto-Create List

**Test ID:** `AI_TASKS_008`  
**Title:** Auto-create list if missing with createListIfMissing=true

**Pre-conditions:** User authenticated, list "NewList" does NOT exist

**Request:**
```json
{
  "listName": "NewList",
  "createListIfMissing": true,
  "tasks": [
    {"name": "First task"}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- `listCreated: true`
- New list appears in GET /api/lists (user's lists)
- New list appears in GET /api/ai/lists/search?q=NewList

**Assertions:**
```javascript
expect(response.body.listCreated).toBe(true);
expect(response.body.listName).toBe("NewList");
// Verify via search endpoint
const searchResponse = await request.get("/api/ai/lists/search").query({q: "NewList"});
expect(searchResponse.body.lists).toHaveLength(1);
```

---

### 1.9 Happy Path: ListId Takes Precedence

**Test ID:** `AI_TASKS_009`  
**Title:** If both listId and listName provided, listId takes precedence

**Pre-conditions:** User has two lists: "A" and "B"

**Request:**
```json
{
  "listId": "id-of-list-A",
  "listName": "ListB",
  "tasks": [{"name": "Task"}]
}
```

**Expected Results:**
- Status: 201 Created
- Task created in ListA (not ListB)
- `listName: "ListA"`

**Assertions:**
```javascript
expect(response.body.listName).toBe("ListA");
expect(response.body.tasksCreated[0].listId).toBe("id-of-list-A");
```

---

### 1.10 Error: Batch Exceeds 50 Tasks

**Test ID:** `AI_TASKS_010`  
**Title:** Reject batch with 51+ tasks

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [ /* 75 task objects */ ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `BATCH_SIZE_EXCEEDED`
- Message: "Maximum 50 tasks per request. Received 75."
- No tasks created
- No list auto-created

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("BATCH_SIZE_EXCEEDED");
expect(response.body.message).toContain("Maximum 50 tasks");
```

---

### 1.11 Error: Empty Batch (0 Tasks)

**Test ID:** `AI_TASKS_011`  
**Title:** Reject empty tasks array

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": []
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `BATCH_SIZE_EXCEEDED`
- Message: "Maximum 50 tasks per request. Received 0."

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("BATCH_SIZE_EXCEEDED");
```

---

### 1.12 Error: Subtasks Exceed 20

**Test ID:** `AI_TASKS_012`  
**Title:** Reject task with 21+ subtasks

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Work",
  "tasks": [
    {
      "name": "Epic",
      "subtasks": [ /* 25 subtask objects */ ]
    }
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Message: "tasks[0].subtasks must not exceed 20 items"
- Field: `tasks[0].subtasks`
- No tasks created

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_REQUEST");
expect(response.body.message).toContain("must not exceed 20");
```

---

### 1.13 Error: Missing Task Name

**Test ID:** `AI_TASKS_013`  
**Title:** Reject task with empty or missing name

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": ""}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Message: "tasks[0].name is required and must be non-empty"
- Field: `tasks[0].name`

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.field).toBe("tasks[0].name");
expect(response.body.error).toBe("INVALID_REQUEST");
```

---

### 1.14 Error: Task Name Exceeds 500 Characters

**Test ID:** `AI_TASKS_014`  
**Title:** Reject task name > 500 chars

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "a".repeat(501)}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Message: "tasks[0].name must not exceed 500 characters"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.message).toContain("exceed 500");
```

---

### 1.15 Error: Invalid Iterations (Non-Integer)

**Test ID:** `AI_TASKS_015`  
**Title:** Reject non-integer iterations

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Task", "iterations": "abc"}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_ITERATIONS`
- Message: "iterations must be a positive integer between 1 and 100"
- Field: `tasks[0].iterations`

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_ITERATIONS");
expect(response.body.received).toBe("abc");
```

---

### 1.16 Error: Negative Iterations

**Test ID:** `AI_TASKS_016`  
**Title:** Reject negative iterations

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Task", "iterations": -5}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_ITERATIONS`
- Message: "iterations must be a positive integer between 1 and 100"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_ITERATIONS");
```

---

### 1.17 Error: Iterations = 0

**Test ID:** `AI_TASKS_017`  
**Title:** Reject zero iterations

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Task", "iterations": 0}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_ITERATIONS`

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_ITERATIONS");
```

---

### 1.18 Error: Iterations > 100

**Test ID:** `AI_TASKS_018`  
**Title:** Reject iterations > 100

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Task", "iterations": 101}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_ITERATIONS`

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_ITERATIONS");
```

---

### 1.19 Error: Missing Auth

**Test ID:** `AI_TASKS_019`  
**Title:** Reject request without auth header

**Pre-conditions:** No x-ms-client-principal header

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [{"name": "Task"}]
}
```

**Expected Results:**
- Status: 401 Unauthorized
- Error code: `UNAUTHORIZED`
- Message: "Authentication required"

**Assertions:**
```javascript
expect(response.status).toBe(401);
expect(response.body.error).toBe("UNAUTHORIZED");
```

---

### 1.20 Error: Missing ListId and ListName

**Test ID:** `AI_TASKS_020`  
**Title:** Reject if neither listId nor listName provided

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "tasks": [{"name": "Task"}]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Message: "Either listId or listName must be provided"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_REQUEST");
expect(response.body.message).toContain("listId or listName");
```

---

### 1.21 Error: List Not Found (No Auto-Create)

**Test ID:** `AI_TASKS_021`  
**Title:** Reject if list not found and createListIfMissing=false

**Pre-conditions:** User authenticated, "NonExistent" list does not exist

**Request:**
```json
{
  "listName": "NonExistent",
  "createListIfMissing": false,
  "tasks": [{"name": "Task"}]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `LIST_NOT_FOUND_NO_AUTO_CREATE`
- Message: "List 'NonExistent' not found. Set createListIfMissing=true to auto-create."

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("LIST_NOT_FOUND_NO_AUTO_CREATE");
```

---

### 1.22 Error: All-or-Nothing Validation (1 Invalid in Batch)

**Test ID:** `AI_TASKS_022`  
**Title:** Reject entire batch if 1 task is invalid (atomic)

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Valid Task 1"},
    {"name": ""},
    {"name": "Valid Task 3"}
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Field: `tasks[1].name`
- No tasks created (atomic failure)
- List not affected

**Assertions:**
```javascript
expect(response.status).toBe(400);
// Verify no tasks were created
const tasksResponse = await request.get("/api/lists/{listId}/tasks");
expect(tasksResponse.body).toHaveLength(0); // or previous count
```

---

### 1.23 Error: Invalid JSON Payload

**Test ID:** `AI_TASKS_023`  
**Title:** Reject malformed JSON

**Pre-conditions:** User authenticated

**Request:**
```
{
  "listName": "Personal",
  "tasks": [{"name": "Task"} INVALID_JSON
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_PAYLOAD`

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_PAYLOAD");
```

---

### 1.24 Error: Missing Tasks Array

**Test ID:** `AI_TASKS_024`  
**Title:** Reject if tasks field is missing

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal"
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Message: "tasks must be an array"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_REQUEST");
```

---

### 1.25 Error: Invalid ListId (Doesn't Exist)

**Test ID:** `AI_TASKS_025`  
**Title:** Reject if listId provided but list doesn't exist

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listId": "nonexistent-uuid-12345",
  "tasks": [{"name": "Task"}]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `LIST_NOT_FOUND`
- Message: "List with ID 'nonexistent-uuid-12345' not found"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("LIST_NOT_FOUND");
```

---

### 1.26 Edge Case: Iterations Rounding

**Test ID:** `AI_TASKS_026`  
**Title:** Round float iterations to nearest integer

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Task A", "iterations": 2.4},
    {"name": "Task B", "iterations": 2.6}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- Task A: `iterations: 2`
- Task B: `iterations: 3`
- `totalPomodorosCreated: 5`

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].iterations).toBe(2);
expect(response.body.tasksCreated[1].iterations).toBe(3);
```

---

### 1.27 Edge Case: Subtask Name Exceeds 500 Characters

**Test ID:** `AI_TASKS_027`  
**Title:** Reject subtask name > 500 chars

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {
      "name": "Parent Task",
      "subtasks": [
        {"name": "a".repeat(501)}
      ]
    }
  ]
}
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_REQUEST`
- Message: "tasks[0].subtasks[0].name must not exceed 500 characters"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.field).toContain("subtasks[0].name");
```

---

### 1.28 Edge Case: Special Characters in Task Name

**Test ID:** `AI_TASKS_028`  
**Title:** Accept special characters in task names

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Buy 🍎 & 🥕 @ $5.99!"},
    {"name": "Meeting: Q3 Review (3-5pm) — TBD?"}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- Names preserved exactly as provided

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].name).toBe("Buy 🍎 & 🥕 @ $5.99!");
expect(response.body.tasksCreated[1].name).toBe("Meeting: Q3 Review (3-5pm) — TBD?");
```

---

### 1.29 Edge Case: Whitespace Trimming in ListName

**Test ID:** `AI_TASKS_029`  
**Title:** Trim whitespace from listName

**Pre-conditions:** User has list named "Personal"

**Request:**
```json
{
  "listName": "  Personal  ",
  "tasks": [{"name": "Task"}]
}
```

**Expected Results:**
- Status: 201 Created
- Task created in existing "Personal" list
- `listCreated: false`
- `listName: "Personal"`

**Assertions:**
```javascript
expect(response.body.listCreated).toBe(false);
expect(response.body.listName).toBe("Personal");
```

---

### 1.30 Edge Case: High Priority Flag

**Test ID:** `AI_TASKS_030`  
**Title:** Preserve isHighPriority flag

**Pre-conditions:** User authenticated

**Request:**
```json
{
  "listName": "Personal",
  "tasks": [
    {"name": "Normal Task", "isHighPriority": false},
    {"name": "Urgent Task", "isHighPriority": true}
  ]
}
```

**Expected Results:**
- Status: 201 Created
- Task 0: `isHighPriority: false`
- Task 1: `isHighPriority: true`

**Assertions:**
```javascript
expect(response.body.tasksCreated[0].isHighPriority).toBe(false);
expect(response.body.tasksCreated[1].isHighPriority).toBe(true);
```

---

## 2. GET /api/ai/lists/search Test Cases

### 2.1 Happy Path: Search by Exact Name

**Test ID:** `AI_SEARCH_001`  
**Title:** Find list by exact name match (case-insensitive)

**Pre-conditions:** User has list "Shopping"

**Request:**
```
GET /api/ai/lists/search?q=Shopping
```

**Expected Results:**
- Status: 200 OK
- `lists.length: 1`
- `lists[0].name: "Shopping"`
- `matchType: "exact"`
- `resultCount: 1`
- `lists[0]` includes `id`, `name`, `taskCount`, `color`, `pinned`, `createdAt`, `order`

**Assertions:**
```javascript
expect(response.status).toBe(200);
expect(response.body.lists).toHaveLength(1);
expect(response.body.lists[0].name).toBe("Shopping");
expect(response.body.matchType).toBe("exact");
```

---

### 2.2 Happy Path: Case-Insensitive Search

**Test ID:** `AI_SEARCH_002`  
**Title:** Search is case-insensitive for exact match

**Pre-conditions:** User has list "Shopping"

**Request:**
```
GET /api/ai/lists/search?q=shopping
GET /api/ai/lists/search?q=SHOPPING
GET /api/ai/lists/search?q=ShOpPiNg
```

**Expected Results:**
- All three queries return the same list
- `lists[0].name: "Shopping"`

**Assertions:**
```javascript
for (const query of ["shopping", "SHOPPING", "ShOpPiNg"]) {
  const response = await request.get("/api/ai/lists/search").query({q: query});
  expect(response.body.lists).toHaveLength(1);
}
```

---

### 2.3 Happy Path: Fuzzy Match (Substring)

**Test ID:** `AI_SEARCH_003`  
**Title:** Fuzzy mode returns substring matches

**Pre-conditions:** User has lists "Shopping", "Shop Tools", "Window Shopping"

**Request:**
```
GET /api/ai/lists/search?q=shop&fuzzy=true
```

**Expected Results:**
- Status: 200 OK
- `lists.length: 3` (all contain "shop")
- `matchType: "fuzzy"`
- Lists sorted by `order`

**Assertions:**
```javascript
expect(response.body.lists).toHaveLength(3);
expect(response.body.matchType).toBe("fuzzy");
```

---

### 2.4 Happy Path: Get All Lists (No Query)

**Test ID:** `AI_SEARCH_004`  
**Title:** Return all user's lists when no search query provided

**Pre-conditions:** User has 5 lists

**Request:**
```
GET /api/ai/lists/search
```

**Expected Results:**
- Status: 200 OK
- `lists.length: 5`
- `matchType: "all"`
- `query: null`
- Lists sorted by `order`

**Assertions:**
```javascript
expect(response.body.lists).toHaveLength(5);
expect(response.body.matchType).toBe("all");
expect(response.body.query).toBeNull();
```

---

### 2.5 Happy Path: Limit Parameter

**Test ID:** `AI_SEARCH_005`  
**Title:** Limit parameter restricts results

**Pre-conditions:** User has 20 lists

**Request:**
```
GET /api/ai/lists/search?limit=5
```

**Expected Results:**
- Status: 200 OK
- `lists.length: 5`
- `resultCount: 5`

**Assertions:**
```javascript
expect(response.body.lists).toHaveLength(5);
expect(response.body.resultCount).toBe(5);
```

---

### 2.6 Happy Path: Task Count in Response

**Test ID:** `AI_SEARCH_006`  
**Title:** Each list includes accurate task count

**Pre-conditions:** 
- User has "Shopping" list with 3 tasks
- User has "Work" list with 12 tasks

**Request:**
```
GET /api/ai/lists/search
```

**Expected Results:**
- Status: 200 OK
- `lists[0].taskCount: 3`
- `lists[1].taskCount: 12`

**Assertions:**
```javascript
const shoppingList = response.body.lists.find(l => l.name === "Shopping");
expect(shoppingList.taskCount).toBe(3);
```

---

### 2.7 Error: Missing Auth

**Test ID:** `AI_SEARCH_007`  
**Title:** Reject request without auth header

**Pre-conditions:** No x-ms-client-principal header

**Request:**
```
GET /api/ai/lists/search?q=Personal
```

**Expected Results:**
- Status: 401 Unauthorized
- Error code: `UNAUTHORIZED`

**Assertions:**
```javascript
expect(response.status).toBe(401);
expect(response.body.error).toBe("UNAUTHORIZED");
```

---

### 2.8 Error: Invalid Limit (0)

**Test ID:** `AI_SEARCH_008`  
**Title:** Reject limit = 0

**Pre-conditions:** User authenticated

**Request:**
```
GET /api/ai/lists/search?limit=0
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_QUERY`
- Message: "limit must be between 1 and 100"

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_QUERY");
```

---

### 2.9 Error: Invalid Limit (Negative)

**Test ID:** `AI_SEARCH_009`  
**Title:** Reject negative limit

**Pre-conditions:** User authenticated

**Request:**
```
GET /api/ai/lists/search?limit=-5
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_QUERY`

**Assertions:**
```javascript
expect(response.status).toBe(400);
```

---

### 2.10 Error: Invalid Limit (>100)

**Test ID:** `AI_SEARCH_010`  
**Title:** Reject limit > 100

**Pre-conditions:** User authenticated

**Request:**
```
GET /api/ai/lists/search?limit=101
```

**Expected Results:**
- Status: 400 Bad Request
- Error code: `INVALID_QUERY`

**Assertions:**
```javascript
expect(response.status).toBe(400);
expect(response.body.error).toBe("INVALID_QUERY");
```

---

### 2.11 Edge Case: Empty Search Result

**Test ID:** `AI_SEARCH_011`  
**Title:** Return empty array if no matches

**Pre-conditions:** User has no list named "Nonexistent"

**Request:**
```
GET /api/ai/lists/search?q=Nonexistent
```

**Expected Results:**
- Status: 200 OK
- `lists: []`
- `resultCount: 0`
- `matchType: "exact"`

**Assertions:**
```javascript
expect(response.status).toBe(200);
expect(response.body.lists).toHaveLength(0);
```

---

### 2.12 Edge Case: Fuzzy Match Order

**Test ID:** `AI_SEARCH_012`  
**Title:** Fuzzy results maintain order by list.order field

**Pre-conditions:**
- User has lists with order [10, 50, 20]: "Shop A", "Shopping", "Shop B"

**Request:**
```
GET /api/ai/lists/search?q=shop&fuzzy=true
```

**Expected Results:**
- Status: 200 OK
- `lists[0].name: "Shop A"` (order 10)
- `lists[1].name: "Shop B"` (order 20)
- `lists[2].name: "Shopping"` (order 50)

**Assertions:**
```javascript
expect(response.body.lists[0].name).toBe("Shop A");
expect(response.body.lists[1].name).toBe("Shop B");
expect(response.body.lists[2].name).toBe("Shopping");
```

---

## 3. Integration Tests

### 3.1 Integration: Create List via AI, then Search

**Test ID:** `AI_INT_001`  
**Title:** Create list via POST /api/ai/tasks, verify via GET /api/ai/lists/search

**Workflow:**
1. POST /api/ai/tasks with `createListIfMissing=true`, `listName="NewProject"`
2. GET /api/ai/lists/search?q=NewProject
3. GET /api/ai/lists/search (retrieve all)

**Expected Results:**
- Step 1: `listCreated: true`
- Step 2: Returns newly created list
- Step 3: New list appears in all lists

**Assertions:**
```javascript
const createResponse = await createTasks({ listName: "NewProject", createListIfMissing: true, ... });
expect(createResponse.body.listCreated).toBe(true);

const searchResponse = await request.get("/api/ai/lists/search").query({q: "NewProject"});
expect(searchResponse.body.lists).toHaveLength(1);
```

---

### 3.2 Integration: Create Tasks, Retrieve via Standard Endpoint

**Test ID:** `AI_INT_002`  
**Title:** Tasks created via AI endpoint are queryable via GET /api/lists/{id}/tasks

**Workflow:**
1. POST /api/ai/tasks (create 5 tasks)
2. GET /api/lists/{listId}/tasks
3. Verify all 5 tasks appear

**Expected Results:**
- All 5 tasks appear in standard endpoint
- Subtasks are embedded correctly

**Assertions:**
```javascript
const tasksResponse = await request.get(`/api/lists/${listId}/tasks`);
expect(tasksResponse.body).toHaveLength(5);
```

---

### 3.3 Integration: Multi-User Isolation

**Test ID:** `AI_INT_003`  
**Title:** User A cannot see User B's lists or tasks

**Workflow:**
1. User A: POST /api/ai/tasks → creates list "Personal-A"
2. User B: GET /api/ai/lists/search → should NOT see "Personal-A"

**Expected Results:**
- User A's lists: include "Personal-A"
- User B's lists: do NOT include "Personal-A"

**Assertions:**
```javascript
const userALists = await searchLists(userAAuth);
expect(userALists.body.lists.some(l => l.name === "Personal-A")).toBe(true);

const userBLists = await searchLists(userBAuth);
expect(userBLists.body.lists.some(l => l.name === "Personal-A")).toBe(false);
```

---

### 3.4 Integration: Subtasks Linked to Parent

**Test ID:** `AI_INT_004`  
**Title:** Subtasks correctly linked to parent task in database

**Workflow:**
1. POST /api/ai/tasks → create task with 3 subtasks
2. GET /api/lists/{id}/tasks/{taskId}
3. Verify subtasks embedded in task

**Expected Results:**
- Response includes task with nested subtasks array
- Each subtask has parent task ID reference (if tracked)

---

### 3.5 Integration: Concurrent Task Creation (Race Condition)

**Test ID:** `AI_INT_005`  
**Title:** Two users simultaneously create same list name (collision handling)

**Workflow:**
1. User A & B both POST /api/ai/tasks with `listName="Work"`, `createListIfMissing=true`
2. Both requests complete
3. User A: GET /api/ai/lists/search?q=Work
4. User B: GET /api/ai/lists/search?q=Work

**Expected Results:**
- User A has one "Work" list (user A's)
- User B has one "Work" list (user B's)
- No collision (userId isolation prevents shared list)

---

## 4. Performance Tests

### 4.1 Performance: Batch Create 50 Tasks

**Test ID:** `AI_PERF_001`  
**Title:** Create 50 tasks in <5s

**Workflow:**
1. POST /api/ai/tasks with 50 tasks
2. Measure response time

**Expected Results:**
- Response time: <5000ms
- Status: 201 Created
- All 50 tasks persisted

**Assertions:**
```javascript
const startTime = Date.now();
const response = await request.post("/api/ai/tasks").send({...});
const elapsed = Date.now() - startTime;
expect(elapsed).toBeLessThan(5000);
```

---

### 4.2 Performance: Search 1000 Lists

**Test ID:** `AI_PERF_002`  
**Title:** Search endpoint completes with 1000+ lists in <1s

**Workflow:**
1. Setup: Create user with 1000+ lists
2. GET /api/ai/lists/search
3. Measure response time

**Expected Results:**
- Response time: <1000ms
- All lists returned (limited by limit param)

---

## 5. Test Data & Fixtures

### 5.1 Mock User IDs

```javascript
const TEST_USERS = {
  USER_A: "test-user-a",
  USER_B: "test-user-b",
  USER_C: "test-user-c",
};

const AUTH_HEADERS = {
  USER_A: {
    "x-ms-client-principal": Buffer.from(JSON.stringify({
      userId: TEST_USERS.USER_A,
      userDetails: TEST_USERS.USER_A,
      claims: [{ typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", val: TEST_USERS.USER_A }],
    })).toString("base64"),
    "x-ms-client-principal-id": TEST_USERS.USER_A,
  },
  // ... similar for USER_B, USER_C
};
```

---

### 5.2 Mock Lists

```javascript
const MOCK_LISTS = {
  PERSONAL: { id: "list-personal-1", name: "Personal", userId: TEST_USERS.USER_A },
  SHOPPING: { id: "list-shopping-1", name: "Shopping", userId: TEST_USERS.USER_A },
  WORK: { id: "list-work-1", name: "Work", userId: TEST_USERS.USER_A },
};
```

---

### 5.3 Mock Task Payloads

```javascript
const MOCK_PAYLOADS = {
  SINGLE_TASK: {
    listName: "Personal",
    tasks: [
      { name: "Buy milk", iterations: 1, isHighPriority: false }
    ]
  },
  BATCH_10: {
    listId: "list-work-1",
    tasks: Array.from({ length: 10 }, (_, i) => ({
      name: `Task ${i + 1}`,
      iterations: (i % 5) + 1,
    }))
  },
  WITH_SUBTASKS: {
    listName: "Work",
    tasks: [
      {
        name: "Project Setup",
        iterations: 2,
        subtasks: [
          { name: "Init repo", iterations: 1 },
          { name: "Install deps", iterations: 1 },
        ]
      }
    ]
  },
};
```

---

## 6. Test Execution & Success Criteria

### 6.1 Execution Plan

- **Phase 1 (Unit):** All 30 POST tests + 12 GET tests
- **Phase 2 (Integration):** Cross-endpoint workflows
- **Phase 3 (Performance):** Load & concurrency tests
- **Phase 4 (Regression):** Run full suite on each deployment

### 6.2 Success Criteria

- **Unit Tests:** 100% pass rate
- **Integration Tests:** 100% pass rate
- **Performance Tests:** All <5s (batch), <1s (search)
- **Coverage:** >90% for API endpoints
- **Error Scenarios:** All error codes tested and validated

---

## 7. Known Limitations & Future Tests

- **Fuzzy matching refinement:** Current implementation uses substring match. Consider Levenshtein distance in future.
- **List collision in auto-create:** Current behavior creates separate lists per user. Test concurrent auto-create race condition.
- **Pagination:** Current limit=100 max. Future: add offset/cursor pagination for large result sets.
- **Soft deletes:** Not tested. Add tests when soft-delete feature is added.

---

## Document History

| Date | Author | Status | Changes |
|------|--------|--------|---------|
| 2026-06-25 | Lambert (QA) | Draft | Initial comprehensive test plan |

