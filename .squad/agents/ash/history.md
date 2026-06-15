# Ash History

## Learnings
- Project: pomo-test1
- User: aisling
- Infrastructure target changed from Static Web Apps to Azure App Service
- Main/test1 workflow was missing an explicit startup command while working slot had one, which can leave slot startup behavior drifting and cause App Service 503 startup failures.
- 2026-05-31: Main/test1 workflow was aligned to the same minimal deploy-package sequence used by working (build frontend + API, package only `dist` plus `src/api/dist` and API prod dependencies) to reduce startup risk from oversized artifacts.
- 2026-06-15: Frontend auth reconciliation now treats explicit 401/403 auth responses as signed-out state, preventing stale cache from restoring signed-in UI after logout.
- 2026-06-15: Logout redirect now uses an absolute root URL and clears local auth state immediately to avoid post-logout blank/relative-path issues.
- 2026-06-15: iPhone standalone/PWA background rendering is more reliable by avoiding fixed attachment for custom image backgrounds in iOS standalone mode.
