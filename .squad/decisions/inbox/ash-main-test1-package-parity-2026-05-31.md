# Decision: Keep test1 explicit startup and enforce packaging parity with working

- Date: 2026-05-31
- By: Ash (DevOps)
- Context: test1 experienced startup probe timeout. Working slot is reported stable after deploy artifact minimization.

## Decision

For App Service deployment workflows in this repo:
- Keep explicit startup command on test1/main workflow as `npm --prefix src/api run start`.
- Keep deploy artifact strategy identical across slots: package only frontend build output and API runtime build output plus API production dependencies.

## Rationale

- Explicit API startup avoids ambiguity in process launch path.
- Small, runtime-only deployment artifacts reduce unzip/install overhead and improve startup probe success odds.

## Scope

- `.github/workflows/main_pomo(test1).yml`
- `.github/workflows/working_pomo(working).yml` (reference strategy)
