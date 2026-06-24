# Parker History

## Learnings
- Project: pomo-test1
- User: aisling
- Backend requirement: Cosmos DB + REST APIs supporting existing React app
- 2026-06-15: Treat Easy Auth display-only fields like `x-ms-client-principal-name` and `userDetails` as non-authoritative; backend auth state must require a durable principal identifier or `/.auth/me` confirmation.
- 2026-06-24: Keep identity resolution consistent across all authenticated REST routes by using the same Easy Auth header + `/.auth/me` fallback path; otherwise `/api/auth/me` can succeed while CRUD routes return 401 after browser restart/session cookie renewal.
- 2026-06-24: User-specific UI preferences that must sync across devices should be stored as a dedicated per-user Cosmos document (fixed id under user partition) to avoid schema drift in list/task records.
