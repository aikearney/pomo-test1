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
