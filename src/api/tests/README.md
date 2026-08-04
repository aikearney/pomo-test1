# Comprehensive Test Documentation: Copilot/Alexa API

**Lambert — QA/Tester**  
**Project:** Pomodoro Timer (pomo-test1)  
**API Endpoints Under Test:**
- POST /api/ai/tasks
- GET /api/ai/lists/search

**Test Framework:** Jest + Supertest  
**Status:** Ready for Implementation

---

## Quick Start

### Install Test Dependencies

```bash
cd src/api
npm install --save-dev jest ts-jest @jest/globals @types/jest supertest @types/supertest
```

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- api.ai-tasks.test.ts

# Run in watch mode (for development)
npm test -- --watch

# Run with verbose output
npm test -- --verbose
```

### Expected Output

```
PASS  tests/api.ai-tasks.test.ts
  POST /api/ai/tasks - Task Creation
    Happy Path: Single Task Creation
      ✓ AI_TASKS_001: Create single task in existing list (45ms)
    Happy Path: Batch Creation
      ✓ AI_TASKS_002: Create batch of 10 tasks (52ms)
      ✓ AI_TASKS_003: Create batch of 50 tasks (max boundary) (48ms)
    ... (120+ tests total)

Test Suites: 1 passed, 1 total
Tests:       125 passed, 125 total
Time:        12.456s
```

---

## Test Structure

### File Organization

```
src/api/
├── tests/
│   ├── fixtures.ts              # Mock data, auth headers, helper functions
│   ├── api.ai-tasks.test.ts    # Main test suite (30 POST, 12 GET tests)
│   └── test-plan.md             # Comprehensive test plan document
├── jest.config.js
├── server.ts
├── shared/
├── tasks/
└── lists/
```

---

## Test Coverage Map

### POST /api/ai/tasks (30 Tests)

| Test Category | Count | IDs |
|---------------|-------|-----|
| **Happy Path** | 9 | AI_TASKS_001 to AI_TASKS_009 |
| **Batch Size Errors** | 2 | AI_TASKS_010, AI_TASKS_011 |
| **Subtask Errors** | 1 | AI_TASKS_012 |
| **Task Name Errors** | 2 | AI_TASKS_013, AI_TASKS_014 |
| **Iterations Errors** | 4 | AI_TASKS_015 to AI_TASKS_018 |
| **Auth Errors** | 1 | AI_TASKS_019 |
| **List Identifier Errors** | 3 | AI_TASKS_020, AI_TASKS_021, AI_TASKS_025 |
| **Atomic Validation** | 1 | AI_TASKS_022 |
| **Payload Errors** | 2 | AI_TASKS_023, AI_TASKS_024 |
| **Edge Cases** | 5 | AI_TASKS_026 to AI_TASKS_030 |

### GET /api/ai/lists/search (12 Tests)

| Test Category | Count | IDs |
|---------------|-------|-----|
| **Happy Path** | 6 | AI_SEARCH_001 to AI_SEARCH_006 |
| **Error Validation** | 4 | AI_SEARCH_007 to AI_SEARCH_010 |
| **Edge Cases** | 2 | AI_SEARCH_011, AI_SEARCH_012 |

### Integration Tests (3 Tests)

| Test | ID | Coverage |
|------|-----|----------|
| Create list via AI + search | AI_INT_001 | Cross-endpoint workflow |
| Create tasks + retrieve via standard endpoint | AI_INT_002 | Data persistence |
| Multi-user isolation | AI_INT_003 | Security & data isolation |

### Performance Tests (1+ Tests)

| Test | ID | Requirement |
|------|-----|-------------|
| Batch create 50 tasks | AI_PERF_001 | < 5 seconds |

---

## Key Test Cases

### Most Critical (Must Pass First)

1. **AI_TASKS_001**: Single task creation (basic functionality)
2. **AI_TASKS_010**: Batch size validation (50-task limit enforcement)
3. **AI_TASKS_012**: Subtask limit validation (20 subtask limit)
4. **AI_TASKS_019**: Auth rejection (security critical)
5. **AI_SEARCH_001**: List search by name (core feature)
6. **AI_INT_001**: Cross-endpoint integration (full workflow)

### Highest Risk (Edge Cases)

1. **AI_TASKS_022**: Atomic validation (all-or-nothing batch)
2. **AI_TASKS_026**: Float rounding (arithmetic accuracy)
3. **AI_INT_003**: Multi-user isolation (security)
4. **AI_SEARCH_003**: Fuzzy matching (query accuracy)

---

## Mock Data & Fixtures

### Authentication Headers

```typescript
// From fixtures.ts
const AUTH_HEADER_USER_A = createAuthHeader("test-user-a-uuid");
// Returns: { "x-ms-client-principal": "...", "x-ms-client-principal-id": "..." }
```

### Sample Task Payload

```json
{
  "listName": "Personal",
  "createListIfMissing": false,
  "tasks": [
    {
      "name": "Buy milk",
      "iterations": 1,
      "isHighPriority": false,
      "subtasks": []
    }
  ]
}
```

### Sample Search Query

```
GET /api/ai/lists/search?q=Shopping&fuzzy=false&limit=10
```

---

## Running Tests Against Real API

### Prerequisites

1. Start the API server (local or remote)
2. Set environment variables:
   ```bash
   export API_BASE_URL=http://localhost:7071
   export TEST_USER_ID=your-test-user-id
   export COSMOS_CONNECTION_STRING=...
   ```

3. Ensure test database is clean and populated with fixtures

### Execute Tests

```bash
npm test -- --runInBand  # Run sequentially (safer for shared DB)
```

---

## Common Test Failures & Remediation

### Failure: "UNAUTHORIZED" on all tests

**Cause:** Missing or invalid x-ms-client-principal header  
**Fix:** Verify `createAuthHeader()` function generates valid base64

```javascript
// Debug: Print auth header
const header = createAuthHeader("test-user-a");
console.log("Auth header:", header["x-ms-client-principal"]);
// Should decode to valid JSON with userId, claims
```

### Failure: "LIST_NOT_FOUND" on AI_TASKS_001

**Cause:** Mock list "Personal" not seeded  
**Fix:** Add setup in `beforeEach()` to create mock lists

```typescript
beforeEach(async () => {
  // Seed test lists for this user
  await createMockList(TEST_USERS.USER_A, MOCK_LISTS.PERSONAL);
});
```

### Failure: Batch tests timeout

**Cause:** Database queries too slow  
**Fix:** Increase Jest timeout or optimize Cosmos queries

```typescript
jest.setTimeout(30000); // 30s timeout
```

---

## Extending the Test Suite

### Adding a New Test Case

1. **Add mock data to fixtures.ts:**
   ```typescript
   export const MOCK_TASK_PAYLOADS = {
     NEW_SCENARIO: { /* payload */ },
   };
   ```

2. **Write test in api.ai-tasks.test.ts:**
   ```typescript
   it("AI_TASKS_XXX: Description", async () => {
     const response = await request(app)
       .post("/api/ai/tasks")
       .set(createAuthHeader(TEST_USERS.USER_A))
       .send(MOCK_TASK_PAYLOADS.NEW_SCENARIO);
     
     expect(response.status).toBe(201);
   });
   ```

3. **Update test-plan.md** with new test case documentation

### Testing a New API Endpoint

1. Create new describe block:
   ```typescript
   describe("POST /api/ai/new-endpoint", () => {
     // tests
   });
   ```

2. Use same pattern: happy path → error cases → edge cases
3. Maintain test ID scheme: `AI_ENDPOINT_###`

---

## Performance Benchmarks

**Target Response Times:**

| Operation | Target | Measured |
|-----------|--------|----------|
| Create 1 task | < 500ms | _pending_ |
| Create 10 tasks | < 1s | _pending_ |
| Create 50 tasks | < 5s | _pending_ |
| Search 1000 lists | < 1s | _pending_ |
| List search (exact) | < 200ms | _pending_ |
| List search (fuzzy) | < 500ms | _pending_ |

---

## Coverage Goals

| Metric | Target | Current |
|--------|--------|---------|
| **Line Coverage** | > 90% | _pending_ |
| **Branch Coverage** | > 85% | _pending_ |
| **Function Coverage** | > 90% | _pending_ |
| **Statement Coverage** | > 90% | _pending_ |

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      - run: cd src/api && npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

---

## Known Limitations & Future Enhancements

### Current Limitations

- Tests use mocked database (Cosmos DB not integrated yet)
- Fuzzy search uses basic substring matching (not Levenshtein distance)
- No concurrent/race condition tests with real DB
- Performance tests don't include network latency

### Planned Enhancements

1. **Real Database Integration**
   - Spin up test Cosmos DB instance
   - Pre-populate fixtures
   - Clean up after each test

2. **Concurrent Testing**
   - Simulate simultaneous requests
   - Test race conditions in list auto-create

3. **Load Testing**
   - 1000+ concurrent requests
   - Measure p99 latency
   - Identify scaling limits

4. **Contract Testing**
   - Validate request/response against OpenAPI spec
   - Prevent accidental API changes

---

## Document History

| Date | Author | Status | Notes |
|------|--------|--------|-------|
| 2026-06-25 | Lambert (QA) | Ready | Initial comprehensive test suite |

---

## Contact & Questions

**Test Suite Owner:** Lambert (QA/Tester)  
**Implementation:** Parker (Backend)  
**Architecture:** Ripley (Lead)

For questions or issues:
1. Check test-plan.md for test case details
2. Review fixtures.ts for mock data structure
3. Consult api.ai-tasks.test.ts for implementation examples
