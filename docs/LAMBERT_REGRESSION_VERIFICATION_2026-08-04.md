# Lambert Regression Verification - 2026-08-04

## Scope

Focused verification picture for reported regressions:

- New login button behavior.
- Logged-out local-cache notice minimization and clear-local-data behavior.
- Recurring tasks reappearing after their scheduled interval.
- Task copy/move expectations between lists versus subtask move/copy between tasks.

## Executable Checks

Run from the repo root unless noted.

```bash
npm run build
npm run build:api
npm run smoke:api
```

Expected interpretation:

- `npm run build` covers frontend TypeScript and Vite packaging for the changed runtime integration surface.
- `npm run build:api` covers the Express API TypeScript surface.
- `npm run smoke:api` covers unauthenticated `GET /api/lists`; authenticated CRUD coverage requires `API_BASE_URL` plus a test auth header/user and a reachable API/Cosmos environment.
- A local `npm run smoke:api` connection failure against `http://localhost:7071` is environment-only when no local API server is running.

## Manual QA Checklist

### Login Button

- Logged out: click the top-right `Login` button.
- Confirm the sign-in overlay opens with provider choices and `Continue without login`.
- Click a provider and confirm navigation targets `/.auth/login/<provider>` with a `post_login_redirect_uri` back to the current app path.
- Signed in: confirm the same button reads `Logout`, clears local auth-derived UI state immediately, and navigates to `/.auth/logout?post_logout_redirect_uri=<origin>/`.

### Logged-Out Local-Mode Notice

- Start logged out with local tasks/lists present.
- Confirm the amber local-mode notice renders collapsed or can be minimized to the one-line `You are in local mode, expand for more info` state.
- Expand the notice and confirm `Clear Local Data` opens the confirmation dialog rather than deleting immediately.
- Confirm clearing removes local lists/tasks, keeps a fresh Personal list available, and does not require cloud services.
- Confirm the notice `Login` action routes through the same Easy Auth login path as the main login affordance.

### Recurring Task Reactivation

- Create or select a recurring task with a short interval.
- Complete the task and confirm `recurrence.lastCompletedAt` is set when the task transitions from incomplete to complete.
- Move the system clock or seeded local storage data beyond the recurrence interval.
- Reload the app or wait up to one minute.
- Confirm the task becomes incomplete, `completedIterations` resets to `0`, and it returns above completed tasks with high-priority tasks first.

### Task Copy/Move Versus Subtasks

- Confirm list duplication is the only current task-list-level copy affordance.
- In local mode, duplicate a list and confirm tasks are copied to the new list with new task ids.
- In authenticated mode, duplicate a list and confirm the current implementation creates an empty copied list; do not treat missing server-side task cloning as a regression unless the acceptance criteria require full remote clone parity.
- For subtasks, open a task item menu and use `Move to task...` and `Copy to task...`.
- Confirm subtask move removes the source subtask and appends it to an incomplete target task in the current list.
- Confirm subtask copy leaves the source subtask in place and appends a new-id copy to the target task.
- Confirm completed target tasks are unavailable for subtask move targets.

### High Priority View

- Create high-priority tasks in at least two active lists, then select `High Priority` from the list selector's Views section.
- Confirm the view includes each high-priority task, labels it with its source list, and does not appear as an editable or persisted task list.
- Complete, edit, and delete a task from the view; return to its source list after each action and confirm the original task reflects that change.
- Confirm list-level actions are unavailable in the aggregate view: adding tasks, templates, reordering, bulk deletion, and task/subtask transfers.
- Confirm background menus no longer offer Dots, Grid, or Diagonal patterns while gradients, mesh gradients, upload, and opacity controls remain available.

## Verification Notes

- The named regressions are not fully covered by existing automated tests; they cross browser auth redirects, local storage, and minute-based recurrence checks.
- The API smoke script is still useful for separating backend contract availability from UI behavior, but authenticated coverage depends on a reachable API and test identity headers.
- The High Priority view is a frontend-only projection: source-task changes use each task's existing `listId` and task endpoint/local storage key rather than creating a list or copying a task.
- No team-level decision is recorded for this pass because this file documents verification scope and current behavior rather than changing product direction.