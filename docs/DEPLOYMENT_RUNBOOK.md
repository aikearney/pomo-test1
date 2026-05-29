# Deployment Runbook (Azure App Service)

This runbook is the production checklist for deploying the single-web-app runtime (React static frontend + Express `/api` in one App Service).

## 1. Startup Command

Configure App Service startup command:

```bash
npm --prefix src/api run start
```

Checklist:
- Confirm deployment artifact includes `dist/` (frontend build output).
- Confirm deployment artifact includes `src/api/` runtime files.
- Confirm App Service is running a supported Node.js version.

## 2. Required App Settings

Set these in App Service Configuration.

Required:
- `COSMOS_CONNECTION_STRING`

Required for auth-enabled APIs:
- `AUTH_CLIENT_ID`

Strongly recommended:
- `AUTH_ALLOWED_AUDIENCES`

Optional (defaults exist in code):
- `COSMOS_DATABASE_ID` (default: `tasks-db`)
- `COSMOS_LISTS_CONTAINER_ID` (default: `lists`)
- `COSMOS_TASKS_CONTAINER_ID` (default: `tasks`)

Accepted alternates:
- `COSMOS_DB_NAME`
- `COSMOS_LISTS_CONTAINER_NAME`
- `COSMOS_TASKS_CONTAINER_NAME`
- `CUSTOMCONNSTR_COSMOS_CONNECTION_STRING`
- `COSMOSDB_CONNECTION_STRING`

Notes:
- Avoid plain secret values in App Settings for production.
- Restart App Service after any setting changes.

## 3. Key Vault References

Use Key Vault references for secret settings (example):

```text
@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/<secret-name>/)
```

Checklist:
- `COSMOS_CONNECTION_STRING` uses Key Vault reference.
- Any auth secrets (if used) use Key Vault references.
- Key Vault firewall/network rules allow App Service access path.

## 4. Managed Identity

Checklist:
- Enable system-assigned managed identity on the App Service.
- Grant identity permission to read required Key Vault secrets.
- If using RBAC-based Key Vault permissions, verify role assignment at vault scope.
- Validate Key Vault references resolve (not in failed/unauthorized state).

## 5. Health Checks

Configure App Service Health check path to:

```text
/api/lists
```

Rationale:
- Returns `200` for unauthenticated requests and does not require auth.

Checklist:
- Health check path configured in App Service.
- Always On enabled for production plans.
- Confirm no auth redirect or middleware blocks the health endpoint.

## 6. Post-Deploy Verification

Run after each production deployment:

1. Confirm startup logs contain `Server listening on` and `Serving frontend assets from`.
2. Verify site root returns the frontend shell (`200`):

```bash
curl -i https://<app-name>.azurewebsites.net/
```

3. Verify API health endpoint returns `200`:

```bash
curl -i https://<app-name>.azurewebsites.net/api/lists
```

4. Verify one authenticated API operation (list or task read/write) against Cosmos DB.
5. Check App Service health status and instance availability.
6. Check Application Insights (if enabled) for startup failures and 5xx spikes.

Rollback trigger examples:
- Health check not passing after warm-up window.
- Repeated startup errors tied to missing app settings or Key Vault resolution failures.
- Elevated 5xx rate after deployment.
