# ✨ Pomodoro Timer!

Designed to help you stay focused and work in short, intentional bursts!

🧠 What Can You Do?
It follows the Pomodoro Technique: you work for 25 minutes, take a short 5minute break, and repeat. After 4 focus sessions, you take a longer 15 minute break to reset.
Start the timer, focus on a single task until the session ends, then step away during the break. The app handles the timing for you so you can concentrate on getting work done without watching the clock.

🚀 The best part?
- You can add your tasks and sub tasks
- Decide how many 25 minute sessions you need per task
- Add your own background

## Prerequisites

- Existing Azure App Service Plan (already created).
- Existing Azure Cosmos DB SQL account/database/containers.

## Runtime Settings

Set these App Settings on the single App Service Web App.

Required:

- `COSMOS_CONNECTION_STRING`
	- Recommended value source: Key Vault reference.

Or (managed identity mode):

- `COSMOS_AUTH_MODE=managed-identity`
- `COSMOS_ENDPOINT` (for example `https://<cosmos-account>.documents.azure.com:443/`)

Optional (defaults shown):

- `COSMOS_DATABASE_ID` (default: `tasks-db`)
- `COSMOS_LISTS_CONTAINER_ID` (default: `lists`)
- `COSMOS_TASKS_CONTAINER_ID` (default: `tasks`)

Accepted alternates:

- `COSMOS_DB_NAME`
- `COSMOS_LISTS_CONTAINER_NAME`
- `COSMOS_TASKS_CONTAINER_NAME`
- `CUSTOMCONNSTR_COSMOS_CONNECTION_STRING`
- `COSMOSDB_CONNECTION_STRING`

Managed identity notes:

- Managed identity mode avoids local keys and connection strings.
- Assign App Service managed identity the Cosmos data-plane role `Cosmos DB Built-in Data Contributor`.
- When cutover is complete and verified, you can disable local authorization in Cosmos.

## Local Validation (No Workflow Required)

Install dependencies:

```bash
npm install
cd src/api && npm install && cd ../..
```

Frontend dev only:

```bash
npm run dev
```

Single-server local run (frontend build + API on one server):

```bash
npm run build:app
npm start
```

The server uses `PORT` (or `API_PORT`) and serves frontend assets from `dist` by default.
Override static path with `FRONTEND_DIST_PATH` if needed.

Minimum validation checks:

1. `GET /api/lists` returns the synthetic Personal list when unauthenticated.
2. Authenticated list/task CRUD works against Cosmos.
3. Frontend task/list flows continue unchanged.

## API Smoke Test Script

Run a minimal post-deployment API smoke test from the repo root.

Unauthenticated-only check (safe local default):

```bash
npm run smoke:api
```

This validates `GET /api/lists` and checks that the anonymous synthetic Personal list contract is intact.

Against a deployed app service:

```bash
API_BASE_URL=https://<your-app>.azurewebsites.net npm run smoke:api
```

Optional authenticated CRUD checks (creates then cleans up one list and one task):

```bash
API_BASE_URL=https://<your-app>.azurewebsites.net \
API_SMOKE_TEST_USER_ID=<test-user-id> \
npm run smoke:api
```

Notes:

- Auth header defaults to `x-ms-client-principal-id`.
- Override with `API_SMOKE_TEST_HEADER` (or `TEST_USER_HEADER`) when needed.
- `API_SMOKE_TIMEOUT_MS` can be used to tune per-request timeout (default `15000`).

## Deployment Notes

- Production startup/app-setting checklist: [Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)

- Build both frontend and API before deploy:

```bash
npm run build:app
```

- Use App Service startup command:

```bash
npm --prefix src/api run start
```

- Keep secrets in Key Vault and use App Setting references.

## Product Summary

- Start 25-minute focus sessions with short and long breaks.
- Track tasks, subtasks, and iteration counts.
- Customize backgrounds.
