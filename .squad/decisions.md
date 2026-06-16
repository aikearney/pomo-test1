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

### 2026-06-15: Frontend auth revalidation and iOS standalone background fallback
- **By:** Dallas
- **Decision:** Treat explicit auth failures from `/api/auth/me` as signed-out state instead of restoring cached auth, re-run auth checks on page restore/focus, use an absolute root logout redirect, and disable `background-attachment: fixed` for custom backgrounds in iOS standalone mode.
- **Rationale:** Prevents stale signed-in UI after server session loss, avoids logout landing on a blank route state, and works around iPhone saved-to-home-screen rendering issues with fixed background images.
- **Scope:** Frontend-only; no backend contract, API payload, or visual redesign changes.
- **Source:** `.squad/decisions/inbox/dallas-auth-pwa.md`

### 2026-06-15: Easy Auth identity proof boundary
- **By:** Parker
- **Decision:** Backend auth helpers must only treat Easy Auth principal id or stable subject/object-id claims as authoritative identity, and must not infer authentication from display-name fields such as `x-ms-client-principal-name` or `userDetails`.
- **Rationale:** Display-only fields can persist when the real session is no longer usable, which creates stale signed-in state and misroutes authenticated API behavior.
- **Scope:** Shared auth extraction and `/api/auth/me` response shaping for App Service Easy Auth.
- **Source:** `.squad/decisions/inbox/parker-auth.md`

### 2026-06-16: Mobile readability QA gate clarification
- **By:** Lambert (Tester)
- **Decision:** For mobile frontend readability verification tasks, use an explicit narrow viewport check (390px width baseline) and treat `npm run build` + browser interaction as the primary gate. Do not treat `npm run smoke:api` failure as a regression signal unless the API smoke test target (`http://localhost:7071`) is intentionally running.
- **Rationale:** The readability fix is UI-layout focused. API smoke tests remain valuable but are environment-dependent and should not block frontend-only verification when the local API endpoint is intentionally absent.
- **Scope:** Testing process guidance for mobile UI verification sessions.
- **Source:** `.squad/decisions/inbox/lambert-mobile-readability-qa.md`

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
