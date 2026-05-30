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

### 2026-05-30: OAuth Authentication Implementation - Hybrid Approach
- **By:** Parker (Backend Dev)
- **Decision:** Implement full OAuth support using Passport.js with a hybrid authentication approach that auto-detects Azure Easy Auth or falls back to Passport-based OAuth. Support Google and Facebook providers with session-based authentication using secure HTTP-only cookies.
- **Key Changes:**
  - Added OAuth endpoints: `/.auth/me`, `/.auth/login/{provider}`, `/.auth/callback/{provider}`, `/.auth/logout`
  - Implemented two authentication modes: Azure Easy Auth (production) and Passport OAuth (local dev)
  - Added dependencies: express-session, passport, passport-google-oauth20, passport-facebook
  - Updated `src/api/server.ts`, `src/api/shared/oauth.ts`, `src/api/shared/auth.ts`
- **Scope:** Backend authentication layer; fixes broken OAuth flow on frontend login.
- **Source:** `.squad/decisions/inbox/parker-oauth-fix.md`

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
