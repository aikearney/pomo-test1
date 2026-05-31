# Squad Decisions

## Active Decisions

### 2026-05-29: Azure secrets and deployment assumptions
- **By:** aisling (via Copilot)
- **Decision:** Treat API/Cosmos settings as potentially incomplete; reuse existing App Service Plan and running Cosmos SQL DB; handle Azure login in workflow; store non-login secrets/keys in Azure Key Vault.
- **Source:** `.squad/decisions/inbox/copilot-directive-2026-05-29T16-16-19Z.md`

### 2026-05-29: Backend architecture target
- **By:** aisling (via Copilot)
- **Decision:** Use a single Web App with a Node REST server, replacing Azure Functions backend outright.
- **Source:** `.squad/decisions/inbox/copilot-directive-2026-05-29T18-03-56Z.md`

### 2026-05-30: Mobile reorder UX parity and reliability
- **By:** Dallas
- **Decision:** Add explicit up/down controls for tasks and subtasks in the task item UI, while preserving drag-and-drop and long-press reorder behavior.
- **Rationale:** Improves touch reliability and one-step moves without regressing existing interaction paths.
- **Scope:** Frontend-only; no backend contract, schema, or payload changes.
- **Source:** `.squad/decisions/inbox/dallas-mobile-reorder.md`

### 2026-05-31: Enforce explicit App Service startup command in deploy workflows
- **By:** Ash (DevOps)
- **Decision:** Require an explicit App Service startup command for all slot deployments of this app: `npm --prefix src/api run start`.
- **Rationale:** Prevents slot/runtime drift and avoids boot failures caused by ambiguous process launch behavior.
- **Scope:** GitHub Actions deployment workflows and operational runbooks.
- **Source:** `.squad/decisions/inbox/ash-main-503-startup.md`

### 2026-05-31: Main branch protection via merge-only flow
- **By:** aisling (via Copilot)
- **Decision:** Do not push directly to `main`; update `main` only through merge flow from another branch/repo.
- **Rationale:** Enforces safer promotion and review discipline for production-facing updates.
- **Scope:** Team workflow and release governance.
- **Source:** `.squad/decisions/inbox/copilot-directive-2026-05-31T16-10-44Z.md`

### 2026-05-31: Align deployment package parity across slots
- **By:** Ash (DevOps)
- **Decision:** Keep deploy artifact strategy aligned with working by shipping frontend/API runtime build output plus API production dependencies; startup behavior remains governed by the explicit startup-command decision above.
- **Rationale:** Reduces artifact bloat and startup probe risk while avoiding policy drift between slots.
- **Scope:** App Service deployment workflows for test1/main and working slots.
- **Source:** `.squad/decisions/inbox/ash-main-test1-package-parity-2026-05-31.md`

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
