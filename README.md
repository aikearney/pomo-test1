# Pomodoro Timer

Pomodoro task manager with a React frontend and REST APIs backed by Azure Cosmos DB.

This repository now uses a single Node web server for both static frontend hosting and `/api` routes, suitable for a single Azure App Service Web App deployment.

## What Stayed The Same

- Frontend UI and behavior.
- Frontend API contract (`/api/lists`, `/api/lists/:id`, `/api/lists/:id/tasks`, `/api/tasks/:id`).
- Core data model for lists and tasks.

## What Changed For App Service Readiness

- Added an Express REST server in `src/api/server.ts`.
- Server now owns the API routes and serves frontend static assets from `dist`.
- Azure Functions runtime scripts/dependencies were removed from active API runtime wiring.
- Legacy Functions artifacts were isolated under `src/api/legacy-functions/` and `.legacy/functions/`.

## Prerequisites

- Existing Azure App Service Plan (already created).
- Existing Azure Cosmos DB SQL account/database/containers.
- Azure Key Vault for secrets.

## Runtime Settings

Set these App Settings on the single App Service Web App.

Required:

- `COSMOS_CONNECTION_STRING`
	- Recommended value source: Key Vault reference.

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

## Key Vault Integration

Use App Service Key Vault references for secrets.

Example value for `COSMOS_CONNECTION_STRING` app setting:

`@Microsoft.KeyVault(SecretUri=https://<your-vault>.vault.azure.net/secrets/<your-secret-name>/)`

Notes:

- Enable managed identity on the app.
- Grant that identity permission to read secrets from Key Vault.
- Keep Azure login logic inside CI/CD workflow later (not in app code).

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

## Legacy Azure Functions Artifacts

- Legacy endpoint/function metadata is isolated in `src/api/legacy-functions/`.
- Legacy local Functions host config is isolated in `.legacy/functions/`.
- These files are retained for reference only and are not used by the active runtime.

## Product Summary

- Start 25-minute focus sessions with short and long breaks.
- Track tasks, subtasks, and iteration counts.
- Customize backgrounds.
