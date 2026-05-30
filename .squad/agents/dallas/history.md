# Dallas History

## Learnings
- Project: pomo-test1
- User: aisling
- Priority: frontend must stay the same during infrastructure migration
- 2026-05-30: Completed mobile reorder UX update by adding explicit up/down controls for tasks and subtasks while retaining drag-and-drop and long-press reorder behavior.
- 2026-05-30: Decision captured in `.squad/decisions.md` with frontend-only scope and no API/schema contract changes.
- 2026-05-30: Completed timer refresh persistence update so active timer state is restored reliably after page reload without changing backend contracts.
- 2026-05-30: Completed compact button layout refactor for task actions — reorganized buttons into grouped layout with dropdown menus for secondary actions. Reduces UI clutter on mobile and desktop. Frontend-only change to `src/components/TaskItem.tsx`; decision documented and orchestration logged.
- 2026-05-30: Completed reorder UX follow-up by keeping arrow-based task/subtask moves, adding move options to three-dot menus, and disabling touch drag interactions for reliability. Frontend-only scope; decision documented in `.squad/decisions.md`.
