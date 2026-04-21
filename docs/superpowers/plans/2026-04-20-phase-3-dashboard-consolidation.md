# Phase 3 — Dashboard Consolidation (Classic View Elimination)

> **Goal:** Remove the `Analytics ↔ Classic` view toggle from DashboardPage and ExecutiveDashboard, keeping only the modern Analytics view. Deletes ~1,590 LOC and eliminates dual maintenance.

**Background:** An earlier cleanup (see commit after `refactor(dashboard): delete 1442 LOC`) already deleted the orphaned `HomeDashboard.tsx` / `CoupaDashboard.tsx` / `CommercialDashboard.tsx` files. What remains is the `Classic` view toggle inside `DashboardPage.tsx` and `ExecutiveDashboard.tsx`, which still import the 4 Classic variant files.

## Current state (dashboard/ directory)

| File | LOC | Role | Status |
|---|---|---|---|
| DashboardPage.tsx | 789 | Unified Analytics (+ Classic toggle) | **Keep** |
| DashboardRouter.tsx | 38 | Routes to DashboardPage | **Keep** |
| ExecutiveDashboard.tsx | 463 | Executive Analytics (+ Classic toggle) | **Keep** |
| HomeDashboardClassic.tsx | 453 | Legacy Classic SAP | **Delete** |
| CoupaDashboardClassic.tsx | 340 | Legacy Classic Coupa | **Delete** |
| CommercialDashboardClassic.tsx | 340 | Legacy Classic Commercial | **Delete** |
| ExecutiveDashboardClassic.tsx | 447 | Legacy Classic Executive | **Delete** |

Total to delete: **~1,580 LOC** + all Classic toggle state + localStorage keys.

## Out of scope

- No backend/data changes
- No new feature work
- No change to DashboardPage's Analytics layout (that's Phase 4 work)
- No change to ExecutiveDashboard's Analytics layout

## Tasks

### Task 1 — Remove Classic toggle from DashboardPage.tsx
- Delete imports: `HomeDashboardClassic`, `CoupaDashboardClassic`, `CommercialDashboardClassic`
- Delete `viewMode` state, `getStoredView()`, localStorage `VIEW_KEY`
- Delete the `Segmented` control in the toolbar that switches Analytics/Classic
- Delete the early-return branch that renders `<*DashboardClassic />`
- Commit: `refactor(dashboard): remove Classic view toggle from DashboardPage`

### Task 2 — Remove Classic toggle from ExecutiveDashboard.tsx
Same pattern:
- Delete import `ExecutiveDashboardClassic`
- Delete `viewMode` state, `VIEW_KEY`, `getStoredView()`
- Delete Segmented toolbar control
- Delete branch rendering `<ExecutiveDashboardClassic />`
- Commit: `refactor(dashboard): remove Classic view toggle from ExecutiveDashboard`

### Task 3 — Delete Classic files
- Delete `HomeDashboardClassic.tsx`, `CoupaDashboardClassic.tsx`, `CommercialDashboardClassic.tsx`, `ExecutiveDashboardClassic.tsx`
- Verify `npx tsc --noEmit` clean (no lingering imports)
- Verify `npx vitest run` still green
- Commit: `chore(dashboard): delete 4 Classic dashboard files (~1580 LOC)`

### Task 4 — User-prefs cleanup
- Delete `localStorage.removeItem('home_dashboard_view')`, `coupa_dashboard_view`, `commercial_dashboard_view`, `exec_dashboard_view` migration in main.tsx or app init (purely hygienic — stale keys don't break anything)
- Commit: `chore(app): clear legacy dashboard_view localStorage keys on startup`

## Verification

- `npx tsc --noEmit` clean
- `npx vitest run` all green
- Manually navigate to `/` (each module: SAP, Coupa, Commercial) and `/executive` — confirm Analytics view renders and no broken toggle button remains
- Lighthouse score on `/` should improve (~400 KB less JS shipped)

## Risks

| Risk | Mitigation |
|---|---|
| Users who rely on Classic view for specific data points | Audit: what data is in Classic that's NOT in Analytics? If anything — port to Analytics before deletion |
| Snapshot tests tied to specific Classic markup | None exist at time of writing; verify via full vitest run |
| Users with `classic` in localStorage get stuck | Task 4 clears the key proactively; failsafe: the toggle button is gone so state is irrelevant |

## Estimated effort
- **4 tasks × ~45 min each = 3 hours** including verification
- Could be a single subagent-driven execution pass

## Why this wasn't done in the dead-code deletion commit
The orphan files (`HomeDashboard.tsx` etc.) had zero external references — safe to delete.
The Classic files still have active imports, so removing them requires first removing the callers (DashboardPage + ExecutiveDashboard Classic toggle). That's a small refactor with its own testing surface, better as its own commit chain.
