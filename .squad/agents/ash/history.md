# Ash History

## Learnings
- Project: pomo-test1
- User: aisling
- Infrastructure target changed from Static Web Apps to Azure App Service
- Main/test1 workflow was missing an explicit startup command while working slot had one, which can leave slot startup behavior drifting and cause App Service 503 startup failures.
- 2026-05-31: Main/test1 workflow was aligned to the same minimal deploy-package sequence used by working (build frontend + API, package only `dist` plus `src/api/dist` and API prod dependencies) to reduce startup risk from oversized artifacts.
