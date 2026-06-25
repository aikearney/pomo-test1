# Ripley History

## Learnings
- Project: pomo-test1
- User: aisling
- Stack: React frontend, TypeScript APIs, Azure deployment target
- Goal: Keep frontend unchanged; host on Azure App Service with Cosmos DB via REST APIs

---

## Incident: Background Persistence Regression (2026-06-25)

### Root Cause
Multi-layered state management bug in `src/App.tsx` (lines 1468–1595) was clearing localStorage when transitioning from unauthenticated to authenticated state.

**The failure cascade:**
1. Initial state (line 1466): Only checked global key, not scoped key for authenticated user
2. First useEffect [authUserId]: When user authenticated, it read both scoped + global, but set to **null** if both missing
3. Save effect: Detected null and executed `localStorage.removeItem()` on both keys
4. Result: Locally-stored background deleted despite no server value existing

### Fixes Applied
| Issue | Location | Fix |
|-------|----------|-----|
| **Null state overwrites** | 1471–1475 | Only set state if non-null value found; preserve existing state otherwise |
| **Server load aggression** | 1534–1538 | Added strict type checking: only load if property exists AND is valid string |
| **Opacity cascade** | 1507–1520 | Applied same conditional-load pattern to prevent opacity regression |

### Architecture Pattern: Local-First With Server Override
Local storage is source of truth for offline/anonymous. Server values only override when explicitly present and valid. Never let absent server responses clear local data.

```typescript
// ✅ Defensive load: only update if value exists
if (hasOwnProperty(prefs, 'backgroundImage') && 
    typeof prefs.backgroundImage === 'string') {
  setBackgroundImage(prefs.backgroundImage)
}
// Missing server value = no state change
```

### Key Lessons
1. **Dependency arrays create invisible races** — effects can silently reset state when auth changes; verify effects don't trigger unintended nulling
2. **Validate API responses before coercion** — absent properties (undefined) differ from null; use strict type guards, not ?? coalescing
3. **Multi-source state needs clear hierarchy** — establish which layer owns each value (local cache vs server), then defend the boundary
