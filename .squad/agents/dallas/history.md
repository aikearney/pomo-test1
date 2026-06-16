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
