# Dallas History

## Learnings
- Project: pomo-test1
- User: aisling
- Priority: frontend must stay the same during infrastructure migration
- 2026-05-30: Completed mobile reorder UX update by adding explicit up/down controls for tasks and subtasks while retaining drag-and-drop and long-press reorder behavior.
- 2026-05-30: Decision captured in `.squad/decisions.md` with frontend-only scope and no API/schema contract changes.
- 2026-05-30: Completed timer refresh persistence update so active timer state is restored reliably after page reload without changing backend contracts.
- 2026-06-15: Fixed auth state reconciliation so explicit unauthenticated responses clear cached signed-in UI instead of restoring stale local auth.
- 2026-06-15: Added auth revalidation on page restore/focus and used a root absolute logout redirect to avoid the post-logout white page.
- 2026-06-15: Disabled fixed attachment for custom background images in iPhone standalone mode so saved-to-home-screen background rendering remains visible.
- 2026-06-16: Validated iPhone-width (390px) task/subtask layout after subtask container change; subtasks render in the dedicated block below task controls, long subtask text wraps/reads normally, and action controls no longer compress text into unusable columns.
- 2026-06-16: Independent narrow-viewport verification reconfirmed acceptance criteria pass with no additional code change required.
- 2026-06-24: Restricted subtask move targets to incomplete tasks only and updated move dialog empty-state text to reflect incomplete-target filtering.
- 2026-06-24: Added session-dismissible logged-out local-cache notice and a compact-mode helper note that tasks are hidden in compact view.
- 2026-06-24: Added dismiss (X) control to timer completion dialog that stops alert audio and closes the prompt without forcing start/skip break.
- 2026-06-24: Enforced auto-collapse of all tasks when switching/opening a list and increased spacing between subtask checkbox and content controls.
- 2026-06-24: Wired tomato icon paths in index HTML and documented required asset path as public/icons/tomato.png for one-step final hookup.
- 2026-06-24: Validation: npm run build passed after frontend updates; only pre-existing CSS optimization and chunk-size warnings remained.
- 2026-06-24: Added automated favicon/app icon generation workflow from public/icons/tomato.png, wired generated icon + manifest links in index.html, and documented missing-source behavior/command in public/icons/README.md.
- 2026-06-25: Fixed login button to call redirectToLogin() instead of setShowLoginOverlay(true); button now properly navigates to auth endpoint. Learned: overlay state toggling was UI-only; auth flows should delegate directly to redirect functions.
- 2026-08-05: High Priority read-only task cards now show passive subtask completion states beneath task metadata while preserving source-task click/keyboard navigation and exposing no mutation controls. Validation: `npm run build` passed with only pre-existing CSS optimizer and chunk-size warnings.
- 2026-08-05: High Priority read-only subtask rows now show explicit singular/plural iteration wording on a visually subordinate wrapping line. Validation: `npm run build` and `git diff --check -- src/components/TaskItem.tsx` passed; existing CSS optimizer and chunk-size warnings remain.
- 2026-08-05: Fixed High Priority source navigation by waiting for authoritative destination-list hydration before expanding and clearing the exact task selection; the expanded task scrolls into view with Add Subtask reachable. Live Chrome checks passed for click and Enter activation, and `npm run build` passed with only existing warnings.
- 2026-08-05: Fixed Personal-list tasks briefly expanding then collapsing when anonymous snapshot refreshes replaced `taskLists`; the task loader now observes active-list membership only in High Priority view, so same-list snapshot replacements no longer rehydrate Personal tasks as collapsed. Validation: `npm run build` passed with only existing CSS optimizer and chunk-size warnings.
