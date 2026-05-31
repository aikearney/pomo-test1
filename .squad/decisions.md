# Squad Decisions

## Active Decisions

### 2026-05-31: Anonymous-mode local storage backup and restore
- **By:** Dallas (Frontend Dev)
- **Decision:** Expose export/import for anonymous-mode localStorage-backed app data from the existing task list dropdown.
- **Scope:** Frontend-only; backup includes `pomodoro-*` keys and `personalTasks`, import replaces matching local app keys and rehydrates UI by reloading the app.
- **Rationale:** Gives local users a simple backup/restore path without affecting authenticated cloud mode.
- **Source:** `.squad/decisions/inbox/dallas-local-storage-backup.md`

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

### 2026-05-30: Compact Button Layout for Task Actions
- **By:** Dallas (Frontend Dev)
- **Decision:** Reorganize task and subtask action buttons into a compact grouped layout with dropdown menu for secondary actions.
- **Problem:** Task action buttons were crowded in a single horizontal line, causing wrapping and visual clutter, especially on mobile.
- **Solution:**
  - Main task buttons: Move controls (up/down) + Select/Play button + Secondary actions in dropdown (recurrence, priority, delete)
  - Subtask buttons: Move controls (up/down) + Iterations badge + More menu (delete)
  - Added `DotsThree` icon from @phosphor-icons for dropdown triggers
- **Benefits:** Compact layout, better visual organization, mobile-friendly, all functionality preserved
- **Scope:** Frontend-only; `src/components/TaskItem.tsx` changes only; no API/schema changes
- **Source:** `.squad/decisions/inbox/dallas-compact-buttons.md`

### 2026-05-30: Reorder UX Choice (Arrows + Menu over Touch Drag)
- **By:** Dallas (Frontend Dev)
- **Decision:** Keep explicit up/down controls for tasks and subtasks, add up/down options to three-dot menus, and disable drag interactions on touch devices.
- **Rationale:** Improves reorder reliability and clarity on touch screens while preserving desktop drag behavior and ordering contracts.
- **Scope:** Frontend-only (`src/components/TaskItem.tsx`, `src/App.tsx` wiring); no API/schema/data-contract changes.
- **Source:** `.squad/decisions/inbox/dallas-reorder-ux-choice.md`

### 2026-05-30: Remove Drag Reorder Across All Devices
- **By:** Dallas (Frontend Dev)
- **Decision:** Remove task and subtask drag-and-drop reorder behavior entirely on all devices, including desktop.
- **Rationale:** Enforce one consistent reorder interaction model everywhere using explicit controls only.
- **UX Scope:** Reorder remains available through up/down arrow buttons and three-dot menu move actions.
- **Implementation Scope:** Frontend-only updates in task list UI wiring and task item components; no backend/API/schema/data-contract changes.
- **Source:** `.squad/decisions/inbox/dallas-remove-desktop-drag.md`

### 2026-05-30: Subtask Enhancements — Move Between Tasks + Horizontal Layout
- **By:** Dallas (Frontend Dev)
- **Decision:** Implement two UI improvements: (1) Add "Move to task..." menu option for subtasks with task picker dialog to transfer subtasks between tasks while preserving state and incomplete→completed ordering; (2) Expand subtask layout horizontally using `min-w-0` and reorganized controls container so names utilize available width with graceful truncation.
- **Scope:** Frontend-only; files changed: `src/components/TaskItem.tsx`, `src/App.tsx`; no API/schema/data-contract changes.
- **Rationale:** Reduces friction for task reorganization; better screen real estate utilization; improved readability of long subtask names.
- **Source:** `.squad/decisions/inbox/dallas-subtask-moves-layout.md`

### 2026-05-30: Subtask Row Text-First Tuning
- **By:** Dallas (Frontend Dev)
- **Decision:** Tune subtask row responsiveness to prioritize subtask name visibility over inline controls.
- **Changes:** Raised layout breakpoints, collapsed inline subtask move arrows to menu in tighter modes, hid iterations badge sooner in tighter modes, reduced compact/tight control footprint, and preserved full action access via the three-dot menu.
- **Scope:** Frontend-only updates in `src/components/TaskItem.tsx`; no API/schema/data-contract changes.
- **Source:** `.squad/decisions/inbox/dallas-subtask-text-first-tuning.md`

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
