# Dallas History

## Learnings
- Project: pomo-test1
- User: aisling
- Priority: frontend must stay the same during infrastructure migration
- 2026-05-31: Completed anonymous-mode local storage backup and restore by exposing export/import from the task list dropdown, backing up `pomodoro-*` keys plus `personalTasks`, and restoring by replacing local app keys and reloading the UI.
- 2026-05-30: Completed mobile reorder UX update by adding explicit up/down controls for tasks and subtasks while retaining drag-and-drop and long-press reorder behavior.
- 2026-05-30: Decision captured in `.squad/decisions.md` with frontend-only scope and no API/schema contract changes.
- 2026-05-30: Completed timer refresh persistence update so active timer state is restored reliably after page reload without changing backend contracts.
- 2026-05-30: Completed compact button layout refactor for task actions — reorganized buttons into grouped layout with dropdown menus for secondary actions. Reduces UI clutter on mobile and desktop. Frontend-only change to `src/components/TaskItem.tsx`; decision documented and orchestration logged.
- 2026-05-30: Completed reorder UX follow-up by keeping arrow-based task/subtask moves, adding move options to three-dot menus, and disabling touch drag interactions for reliability. Frontend-only scope; decision documented in `.squad/decisions.md`.
- 2026-05-30: Completed reorder interaction standardization by removing drag-and-drop reorder on desktop and mobile, keeping explicit arrow/menu move actions as the only reorder path. Frontend-only scope; decision merged from inbox into `.squad/decisions.md`.
- 2026-05-30: Completed subtask enhancements with (1) "Move to task..." menu option + task picker dialog for cross-task subtask transfer preserving incomplete→completed ordering and (2) horizontal layout expansion using `min-w-0` and reorganized controls. Frontend-only scope; decision merged into `.squad/decisions.md`.
- 2026-05-30: Completed subtask horizontal-space layout fix by ensuring subtask name rows fully consume available width (with `min-w-0` + right-aligned control grouping) so long names truncate cleanly instead of crowding left.
- 2026-05-30: Completed subtask text-wrapping/text-first tuning update to prioritize subtask name visibility on narrow widths by shifting move arrows and status affordances into tighter-mode menu paths while keeping all actions accessible. Frontend-only scope; decision merged into `.squad/decisions.md`.
- 2026-05-30: Completed subtask autogrow textbox improvement so subtask input fields expand with content for better editing ergonomics while preserving existing task/subtask data contracts.
