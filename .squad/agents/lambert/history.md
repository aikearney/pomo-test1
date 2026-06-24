# Lambert History

## Learnings
- Project: pomo-test1
- User: aisling
- Migration risk area: preserve behavior while changing hosting/runtime
- 2026-06-15: Cheapest current executable validation is `npm run smoke:api`, which covers unauthenticated `GET /api/lists` plus optional authenticated list/task CRUD when a server is running and auth test headers are provided.
- 2026-06-15: No automated test currently covers frontend logout redirect state reset, stale auth-cache fallback behavior in `loadAuthState`, or background persistence/load on startup/home-screen launch.
- 2026-06-15: Current logout regression risk is split between immediate local state reset in `redirectToLogout` and later fallback-to-cache branches in `loadAuthState`; the narrowest future validation is a browser-level check that clicks logout, asserts `/.auth/logout?post_logout_redirect_uri=...`, and verifies the signed-in UI/cache clear before redirect.
- 2026-06-15: Current stale signed-in cache risk is that any non-OK `/api/auth/me` response still restores cached auth, so the narrowest validation is a browser test that seeds `pomodoro-auth-cache`, mocks `/api/auth/me` to return `401`, and asserts the app does not remain signed in after logout.
- 2026-06-15: Current saved-to-home-screen background risk is localStorage-only restoration; the narrowest validation is a browser test that seeds `pomodoro-background` and `pomodoro-background-opacity` before app bootstrap and asserts the background overlay/style is applied on first render after reload.
- 2026-06-15: No local Dallas/Parker worktree changes were present during this check, so there was no touched slice to revalidate beyond inspecting current main-branch auth/background behavior.
- 2026-06-16: Verified on 390px viewport that subtasks render in a dedicated section below task-level options and long subtask names wrap without collapsing into an unusable narrow control column.
- 2026-06-16: `npm run smoke:api` still targets `http://localhost:7071`; failure there is expected when API server is not running and should not be treated as a frontend-only regression signal.
- 2026-06-16: Independent QA verification passed all mobile readability acceptance criteria with no code changes required.
- 2026-06-24: Verified `handleSelectTaskList` collapses all tasks on list open by setting `allTasksCollapsed` true and forcing each task `collapsed: true`, preserving the requested auto-collapse behavior.
- 2026-06-24: Verified local-mode/logged-out warning is now dismissible via `isLocalModeNoticeDismissed`; dismissal is session-scoped and resets when local-mode warning no longer applies.
- 2026-06-24: Verified compact timer includes both reduced timer sizing and an explicit muted-state note (`Muted`) when sound is off.
- 2026-06-24: API smoke and API build remain environment-sensitive gates: smoke fails if no local API server runs on `http://localhost:7071`, and direct `npm run build:api` from repo root can fail when API package deps/types are not installed in the active node_modules layout.
- 2026-06-24: App icon integration is currently incomplete in app source: no project-owned icon/manifest assets were found outside dependencies, and `index.html` has no favicon/apple-touch/manifest links.
