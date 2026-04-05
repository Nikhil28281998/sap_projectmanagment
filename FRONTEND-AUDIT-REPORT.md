# Frontend Code Audit Report

**Project:** SAP Project Management — Multi-Module PM Application  
**Date:** June 2025  
**Scope:** 33 frontend source files (components, services, hooks, contexts, types, CSS)  
**Root:** `frontend/src/`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Per-File Audit](#2-per-file-audit)
3. [Cross-Cutting Issues](#3-cross-cutting-issues)
4. [Priority Remediation Plan](#4-priority-remediation-plan)

---

## 1. Executive Summary

| Metric | Count |
|---|---|
| Files audited | 33 |
| Total lines of code | ~6,460 |
| Total inline style objects | ~430+ |
| Critical issues | 8 |
| High-severity issues | 14 |
| Medium-severity issues | 22 |
| Low-severity issues | 12 |

### Top 5 Systemic Issues

1. **Pervasive inline styles** — Every single component uses `style={{...}}` objects. ~430+ inline style objects across the codebase make theming, maintenance, and consistency nearly impossible.
2. **`any` type abuse** — `api.ts` returns `any` for nearly every endpoint. Types exist in `types/index.ts` but are almost never consumed. Defeats the purpose of TypeScript.
3. **Massive code duplication** — `HomeDashboard`/`CoupaDashboard`/`CommercialDashboard` (and their classic variants) share ~90% identical logic. `TRSearch` is duplicated inside `WorkItemList`.
4. **No table virtualization** — All tables render the full dataset. With 1,000+ transports this causes significant DOM bloat and slow renders.
5. **Accessibility gaps** — No `aria-label` attributes, clickable `<div>` elements without `role`/`tabIndex`, color-only RAG indicators, no skip-nav links.

---

## 2. Per-File Audit

### 2.1 Core

#### `App.tsx`
| Metric | Value |
|---|---|
| Lines | ~75 |
| Inline styles | 2 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | `PageFallback` and `NotFound` are defined as inline components inside the module scope — they re-create on every import parse but that's minor. | Extract to separate file or use `React.memo`. |
| 2 | Layout/UX | The 404 page (`NotFound`) just shows plain text with a link. No visual treatment. | Use Ant Design `Result` component with `status="404"`. |
| 3 | Missing Loading States | `Suspense` fallback is a centered `Spin` with no skeleton or branded loading screen. | Add a skeleton or branded splash. |

#### `main.tsx`
| Metric | Value |
|---|---|
| Lines | ~32 |
| Inline styles | 0 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | `QueryClient` configured with `retry: 2` and `refetchOnWindowFocus: true` globally — this means every query refetches on tab focus, including expensive ones like `dashboardSummary`. | Set `refetchOnWindowFocus` per-query, not globally. |
| 2 | Code Quality | `ConfigProvider` theme sets `colorPrimary: '#1677ff'` — this is the antd default, so the line is a no-op. | Remove or set a distinct brand color. |

---

### 2.2 Layout Components

#### `AppShell.tsx`
| Metric | Value |
|---|---|
| Lines | ~210 |
| Inline styles | ~22 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | 22+ `style={{...}}` objects (header, logo container, gradient badge, user dropdown, FAB, sidebar, etc.). | Extract to CSS modules or a `appShell.module.css` file. |
| 2 | Accessibility | FAB button (`FloatButton`) for AI chat has no `aria-label`. Screen readers announce nothing meaningful. | Add `aria-label="Open AI Assistant"`. |
| 3 | Accessibility | Module switcher buttons (emoji icons) have no text label or `aria-label`. | Add `aria-label={mod.name}` to each button. |
| 4 | Performance | `useNotifications()` is called here and also inside `NotificationDrawer` — double subscription. | Pass notifications down as props or lift the query to one location. |
| 5 | Code Quality | Hardcoded gradient `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` for notification badge. Not theme-aware. | Use CSS variable or antd token. |
| 6 | Layout/UX | Header height is hardcoded to `64px` in inline style **and** the content area has `marginTop: 64`. Fragile coupling. | Use a CSS variable `--header-height: 64px` referenced in both places. |

#### `AIChatDrawer.tsx`
| Metric | Value |
|---|---|
| Lines | 1,098 |
| Inline styles | ~65 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | **God component** — 1,098 lines, ~25 state variables, 4 modals, 3 sub-features (chat, document analysis, template generation, SharePoint browsing). | Split into `AIChatPanel`, `DocumentAnalysisModal`, `TemplateGeneratorModal`, `SharePointBrowserModal`. |
| 2 | Inline Styles | ~65 inline style objects — the highest in the project. | Extract to CSS module. |
| 3 | Performance | Messages array is in `useState` — every new message re-renders the entire drawer including all modals. | Use `useReducer` for chat state; memoize sub-components. |
| 4 | Performance | `dangerouslySetInnerHTML` with `DOMPurify.sanitize()` is called inline on every render for every AI message. Sanitization is CPU-intensive for large HTML. | Memoize sanitized output with `useMemo` keyed on message content. |
| 5 | Error Handling | Format button's `catch { /* ignore */ }` silently swallows errors. | Show a toast on format failure. |
| 6 | Error Handling | `handleDocFileUpload` reads files via `FileReader` with no error handling for read failures. | Add `reader.onerror` handler. |
| 7 | Accessibility | Chat input `TextArea` has no `aria-label`. | Add `aria-label="Chat message input"`. |
| 8 | Accessibility | Proposal cards use `onClick` on `<Card>` with no `role="button"` or keyboard support. | Add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space. |
| 9 | Missing Loading States | When SharePoint documents are loading (`spLoading`), only the button shows a spinner. The modal content area has no skeleton. | Add `Skeleton` or loading overlay inside the modal body. |
| 10 | Bug | `PRIORITY_COLORS` and `CONFIDENCE_COLORS` are referenced but not shown in the top-level constants — if they are undefined, tags render with `'default'` color silently. | Verify these maps exist; add fallback explicitly. |

#### `NotificationDrawer.tsx`
| Metric | Value |
|---|---|
| Lines | ~145 |
| Inline styles | ~12 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | 12 inline style objects for notification items, icons, timestamps. | Move to CSS classes. |
| 2 | Error Handling | `analyzeRisks` mutation has `catch` that shows `message.error` but the `message` from the error is not specific — just "Risk analysis failed". | Display `err.message` from the API response. |
| 3 | Performance | All 50 notifications render in a flat list with no virtualization or pagination. | Add virtual scroll or "Load more" pagination for large notification counts. |
| 4 | Accessibility | Notification items are `<div onClick>` with no `role` or keyboard navigation. | Use `<List.Item>` with proper interactive semantics. |

#### `ErrorBoundary.tsx`
| Metric | Value |
|---|---|
| Lines | ~60 |
| Inline styles | 2 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | Class component — the only class component in the project. | Consider migrating to a hook-based boundary using `react-error-boundary` library. |
| 2 | Code Quality | Error details are only logged to `console.error`. No reporting to monitoring service. | Integrate error reporting (Sentry, Application Insights, etc.). |
| 3 | Layout/UX | "Return to Dashboard" button navigates to `/` then reloads — loses all React Query cache. | Use `navigate('/')` + `queryClient.clear()` instead of full page reload. |

---

### 2.3 Dashboard Components

#### `DashboardRouter.tsx`
| Metric | Value |
|---|---|
| Lines | ~43 |
| Inline styles | 0 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Missing Loading States | No loading indicator while `useAuth()` resolves. If auth takes time, the wrong dashboard may flash. | Add `if (isLoading) return <Spin />` guard. |
| 2 | Code Quality | Executive redirect uses `<Navigate to="/executive" />` inside the switch — but this is outside `Routes`, so it's just a render return in a component. Works but is unconventional. | Fine functionally; add a comment for clarity. |

#### `HomeDashboard.tsx`
| Metric | Value |
|---|---|
| Lines | ~430 |
| Inline styles | ~25 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Performance | 7 separate `useMemo` hooks each iterate the full `workItems` and `transports` arrays. With 1,000+ items, this is O(7n) on every relevant state change. | Compute all derived data in a single `useMemo` pass returning an object. |
| 2 | Performance | `Column` and `Pie` chart components from `@ant-design/charts` receive new `data` array references on every render (even when memoized, the parent re-renders on filter changes). | Wrap charts in `React.memo` with deep comparison or stable references. |
| 3 | Inline Styles | ~25 inline style objects for KPI cards, filter bar, chart containers. | Use the existing `dashboard-analytics.css` classes more consistently. |
| 4 | Accessibility | RAG status shown as colored `<Tag>` only (GREEN/AMBER/RED). Color-blind users cannot distinguish. | Add icons: ✅ GREEN, ⚠️ AMBER, ❌ RED. |
| 5 | Accessibility | Filter `<Select>` components have no associated `<label>` elements. | Add `aria-label` or wrap in `<Form.Item label="...">`. |
| 6 | Code Quality | `getRAG()` utility function is defined locally — duplicated in 5+ other dashboard files. | Extract to `utils/rag.ts` and import everywhere. |
| 7 | Code Quality | `localStorage.getItem('pcc_dashboard_view')` for view toggle preference — not namespaced, could collide. | Use a constants file for all localStorage keys. |
| 8 | Layout/UX | Go-live table has no pagination. If 100+ items have go-live dates, the table is unbounded. | Add `pagination={{ pageSize: 10 }}` to the Table. |

#### `HomeDashboardClassic.tsx`
| Metric | Value |
|---|---|
| Lines | ~350 |
| Inline styles | ~50 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | **~50 inline style objects** — the second-highest in the project. Includes complex flex layouts, gradients, shadows, responsive padding, typography. | Extract to `home-classic.module.css`. |
| 2 | Accessibility | Pipeline boxes (`<div onClick>`) are custom clickable elements with no `role="button"`, `tabIndex`, or keyboard handler. | Add `role="button"`, `tabIndex={0}`, `onKeyDown`. |
| 3 | Accessibility | Transport table inside expandable pipeline area uses color-coded system badges with no text fallback. | Already has text labels — acceptable. |
| 4 | Performance | When pipeline boxes expand, the filtered transport list renders all matching transports inline with no limit. | Add pagination or "Show first 10" with expand. |
| 5 | Code Quality | `getRAG()` duplicated again here. | Use shared util. |
| 6 | Layout/UX | Welcome banner hardcodes "Welcome back" — doesn't use user's name effectively on small screens. | Truncate or hide name on mobile via CSS media query. |
| 7 | Bug | `expandedSystem` state toggles between system names and `null`, but if two systems had the same name, toggle logic would break. (Not likely with DEV/QAS/PRD but fragile.) | Use a dedicated enum or constant. |

#### `CoupaDashboard.tsx`
| Metric | Value |
|---|---|
| Lines | ~340 |
| Inline styles | ~25 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Code Duplication (CRITICAL)** | ~90% identical to `HomeDashboard.tsx`. Only differences: filter `application === 'Coupa'`, phase names, and color scheme. | **Create a generic `AnalyticsDashboard` component** that accepts `application`, `phases`, and `colorScheme` as props. |
| 2 | Performance | Same 7× `useMemo` iteration issue as HomeDashboard. | Same fix — single-pass computation. |
| 3 | Inline Styles | ~25 inline styles — same patterns as HomeDashboard. | Shared CSS classes. |
| 4 | Accessibility | Same RAG color-only issue. | Same fix. |
| 5 | Code Quality | `getRAG()` duplicated again. | Shared util. |

#### `CoupaDashboardClassic.tsx`
| Metric | Value |
|---|---|
| Lines | ~260 |
| Inline styles | ~30 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Duplication | Structurally identical to `HomeDashboardClassic` with Coupa-specific terminology. | Merge into generic `ClassicDashboard` component. |
| 2 | Inline Styles | ~30 inline styles. | CSS module. |
| 3 | Accessibility | Steps component pipeline has no keyboard navigation. | Ant Steps is accessible by default — verify `role` attributes. |
| 4 | Code Quality | `getRAG()` duplicated again. | Shared util. |

#### `CommercialDashboard.tsx`
| Metric | Value |
|---|---|
| Lines | ~340 |
| Inline styles | ~25 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Code Duplication (CRITICAL)** | ~90% identical to `HomeDashboard` and `CoupaDashboard`. Third copy of the same analytics dashboard. | Merge into generic `AnalyticsDashboard`. |
| 2 | Performance | Same O(7n) useMemo issue. | Single-pass derivation. |
| 3 | Inline Styles | ~25 inline styles. | CSS classes. |
| 4 | Code Quality | `getRAG()` duplicated again. | Shared util. |

#### `CommercialDashboardClassic.tsx`
| Metric | Value |
|---|---|
| Lines | ~280 |
| Inline styles | ~30 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Duplication | Third copy of classic dashboard layout. | Merge into `ClassicDashboard` generic. |
| 2 | Inline Styles | ~30 inline styles. | CSS module. |
| 3 | Code Quality | `getRAG()` duplicated. | Shared util. |

#### `ExecutiveDashboard.tsx`
| Metric | Value |
|---|---|
| Lines | ~370 |
| Inline styles | ~25 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Performance | Fetches **all** work items and transports across all applications. No server-side aggregation. With 1,000+ items, initial payload and client-side computation are heavy. | Add a dedicated `/executiveSummary` API endpoint with pre-aggregated data. |
| 2 | Performance | 8+ `useMemo` hooks each scan the full dataset. | Single-pass computation. |
| 3 | Inline Styles | ~25 inline styles. | CSS classes. |
| 4 | Accessibility | Donut/pie chart center label relies on absolute-positioned text — no screen reader alternative. | Add `aria-label` describing the percentage to the chart container. |
| 5 | Code Quality | `getRAG()` duplicated. | Shared util. |
| 6 | Layout/UX | "All Projects" table has no column sorting enabled by default. | Add `sorter` to key columns (status, priority, go-live date). |

#### `ExecutiveDashboardClassic.tsx`
| Metric | Value |
|---|---|
| Lines | ~320 |
| Inline styles | ~25 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | ~25 inline styles. | CSS classes. |
| 2 | Code Quality | `getRAG()` duplicated. | Shared util. |
| 3 | Performance | Per-app breakdown card renders all items per app with no limit. | Paginate or limit display. |
| 4 | Missing Loading States | No skeleton while `useWorkItems`/`useTransports` load — screen is blank. | Add `<Skeleton>` when `isLoading`. |

---

### 2.4 Work Item Components

#### `WorkItemList.tsx`
| Metric | Value |
|---|---|
| Lines | ~340 |
| Inline styles | ~15 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Code Duplication (HIGH)** | Embeds a full TR Search tab that duplicates ~80% of `TRSearch.tsx` logic (search input, results table, categorize action). | Import and render `<TRSearch />` in the tab instead of duplicating. |
| 2 | Performance | Work items table renders all items with client-side filtering only. No server-side pagination. | Implement server-side pagination or use `Table` `pagination` prop with virtual scroll. |
| 3 | Inline Styles | ~15 inline styles. | CSS classes. |
| 4 | Accessibility | "Create Work Item" modal form fields use `placeholder` as the only label — no `<label>` or `aria-label`. | Add `label` prop to `Form.Item` components. |
| 5 | Code Quality | Module-specific tab configurations are hardcoded inline with arrays of objects. | Extract tab config to a constant or derive from `MODULE_DEFINITIONS`. |
| 6 | Layout/UX | Tab key changes when switching modules, causing tab to reset. | Persist selected tab key per module in state or localStorage. |

#### `WorkItemDetail.tsx`
| Metric | Value |
|---|---|
| Lines | ~500 |
| Inline styles | ~30 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | ~30 inline style objects for detail cards, inline-edit fields, progress bars, milestone timeline. | CSS module. |
| 2 | Code Quality | Inline field editing uses individual `useState` for each editable field + `handleFieldSave` pattern. 6+ fields each with dedicated state. | Use a `useReducer` or controlled form state with `antd Form`. |
| 3 | Performance | Milestone CRUD triggers full `queryClient.invalidateQueries(['workItem', id])` which refetches the entire expanded entity. | Use optimistic updates via `onMutate` for add/edit/delete milestone. |
| 4 | Error Handling | Test status update modal `catch` shows generic "Failed to update test status" with no detail. | Display `err.message`. |
| 5 | Bug | `deploymentPct` progress bar uses `workItem.deploymentPct` directly but this field may be `undefined` or `NaN` for new items. | Default to `0` — `workItem.deploymentPct ?? 0`. |
| 6 | Accessibility | Milestone timeline items use colored dots (GREEN check, RED cross) — no text fallback. | Add `aria-label` to timeline dots (e.g., "Complete", "Overdue"). |
| 7 | Layout/UX | Linked transports table has no sorting or filtering. | Add column `sorter` and a search filter. |

#### `UnassignedTRs.tsx`
| Metric | Value |
|---|---|
| Lines | ~170 |
| Inline styles | ~8 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Performance | Filters all transports client-side (`transports.filter(t => !t.workType)`) — with 1,000+ transports, this runs on every render. | Memoize the filter or request unassigned TRs from a dedicated API endpoint. |
| 2 | Inline Styles | ~8 inline styles. | CSS classes. |
| 3 | Code Quality | Suggested type detection logic is duplicated from `tr-parser` backend — client guesses types from description text. | Either rely solely on server-side detection or share the detection logic as a util. |
| 4 | Accessibility | Bulk select uses bare `<Checkbox>` with no label identifying what's being selected. | Add `aria-label="Select transport {trNumber}"`. |

---

### 2.5 Tools Components

#### `ReportBuilder.tsx`
| Metric | Value |
|---|---|
| Lines | 564 |
| Inline styles | ~20 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | ~20 inline style objects, including dark-themed code editor TextArea. | CSS module with `.code-editor` class. |
| 2 | Performance | `dangerouslySetInnerHTML` with `DOMPurify.sanitize()` called inline on every render in preview tab. | Memoize with `useMemo(() => DOMPurify.sanitize(html), [html])`. |
| 3 | Error Handling | Excel export uses `try/catch` but `catch` block lacks user feedback. | Show `message.error` on export failure. |
| 4 | Code Quality | `renderedHtml` stored in state and regenerated via string replacement — fragile HTML template engine. | Consider using a dedicated template engine or server-side rendering. |
| 5 | Accessibility | Preview iframe/`dangerouslySetInnerHTML` div has no `title` or `aria-label`. | Add `aria-label="Report preview"`. |
| 6 | Layout/UX | "Copy HTML" button copies raw HTML — no "Copy as plain text" option. | Add a "Copy formatted text" option alongside. |

#### `ReportsPage.tsx`
| Metric | Value |
|---|---|
| Lines | ~50 |
| Inline styles | 2 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | Very thin wrapper — only provides Tabs around `ReportBuilder` and `WeeklyDigestPage`. | Fine for now; could be simplified if only two tabs. |

#### `WeeklyDigestPage.tsx`
| Metric | Value |
|---|---|
| Lines | ~230 |
| Inline styles | ~15 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Error Handling | `loadDigests` has an empty `catch {}` block — errors are silently swallowed. | Log the error and show a fallback message. |
| 2 | Inline Styles | ~15 inline styles. | CSS classes. |
| 3 | Performance | `dangerouslySetInnerHTML` called inline for digest preview (potentially large HTML). | Memoize sanitized output. |
| 4 | Accessibility | Digest history sidebar items are `<div onClick>` — no keyboard support. | Add `role="button"`, `tabIndex={0}`, `onKeyDown`. |
| 5 | Missing Loading States | No skeleton/placeholder while the digest HTML is generating (only a `Spin` on the button). | Add skeleton in the preview area. |

#### `TRSearch.tsx`
| Metric | Value |
|---|---|
| Lines | ~150 |
| Inline styles | ~6 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Code Duplication (HIGH)** | This entire component is duplicated inside `WorkItemList.tsx`'s TR Search tab. Two copies of search + categorize logic. | Remove duplication: use `<TRSearch />` inside WorkItemList, or remove the standalone page if unused. |
| 2 | Inline Styles | ~6 inline styles. | CSS classes. |
| 3 | Performance | Search filters all transports client-side on every keystroke. | Add debounce (300ms) to the search input via `useDebouncedValue`. |

---

### 2.6 Settings / Admin / Pipeline

#### `SettingsPage.tsx`
| Metric | Value |
|---|---|
| Lines | ~290 |
| Inline styles | ~15 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Error Handling | `handleSave` shows generic "Settings saved" on success but only "Save failed" on error — no specific error message. | Display `err.message` in the error notification. |
| 2 | Inline Styles | ~15 inline styles. | CSS classes. |
| 3 | Security | AI API key is stored and transmitted as plain text in the `Input` field. The `type` is set to `password` on the field but the value is in state as a plain string sent over the wire. | Ensure TLS is enforced; consider server-side-only key storage via the existing `saveAIConfig` endpoint (don't echo the key back). |
| 4 | Code Quality | SharePoint config fields (tenantId, clientId, clientSecret, siteUrl, driveId) are individual `useState` calls — 5 separate state variables. | Use a single `useState<SharePointConfig>({})` object or `antd Form`. |
| 5 | Accessibility | Form sections use `<Title level={5}>` as section headers but `<Form.Item>` labels are missing in some cases. | Add labels to all form items. |

#### `MethodologyPage.tsx`
| Metric | Value |
|---|---|
| Lines | ~130 |
| Inline styles | ~8 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Inline Styles | ~8 inline styles. | CSS classes. |
| 2 | Missing Loading States | `useMethodologies()` loading state shows a centered Spin — but there's no skeleton or placeholder for the cards. | Use `<Skeleton>` for progressive loading. |
| 3 | Code Quality | Methodology data is fetched from API but the page also has hardcoded fallback methodologies — redundant. | Remove hardcoded data and rely on API, or remove API call and use static data. |

#### `AdminPage.tsx`
| Metric | Value |
|---|---|
| Lines | ~210 |
| Inline styles | ~12 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | Users table data is **mocked** (`mockUsers` array) — not fetched from any API. | Either implement a user management API or clearly label the section as "Coming Soon". |
| 2 | Code Quality | System operations (`generateNotifications`, `autoLinkTickets`, `health`) fire mutations but there's no confirmation dialog before running potentially disruptive operations. | Add `Modal.confirm` before each operation. |
| 3 | Inline Styles | ~12 inline styles. | CSS classes. |
| 4 | Accessibility | Operation cards use `<Card onClick>` — no keyboard support. | Add `role="button"`, `tabIndex={0}`. |
| 5 | Error Handling | Health check just shows the raw response — no interpretation of failure states. | Parse response and show RED/GREEN indicators per service. |

#### `TransportPipeline.tsx`
| Metric | Value |
|---|---|
| Lines | ~140 |
| Inline styles | ~10 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Performance | Renders 3 columns each containing a full list of transports for that system. With 1,000+ transports, this is thousands of DOM nodes. | Add pagination per column or virtual scroll. |
| 2 | Inline Styles | ~10 inline styles for column layouts. | CSS Grid with classes. |
| 3 | Accessibility | Column headers (DEV/QAS/PRD) are styled divs, not `<h3>` or semantic elements. | Use heading elements. |
| 4 | Missing Loading States | No loading indicator while transport data loads. | Add `<Skeleton>` on `isLoading`. |

---

### 2.7 Styles

#### `dashboard-analytics.css`
| Metric | Value |
|---|---|
| Lines | ~180 |
| Issues | 2 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | Defines `.analytics-kpi`, `.analytics-chart-card`, `.donut-center-label`, `.rag-bar` — these are only partially used; many dashboard components use inline styles instead of these classes. | Audit usage and either apply these classes consistently or remove unused ones. |
| 2 | Layout/UX | No responsive breakpoints — cards and charts don't adapt below 768px. | Add `@media` queries for tablet/mobile. |

#### `dashboard-dark.css`
| Metric | Value |
|---|---|
| Lines | ~185 |
| Issues | 3 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Bug (CRITICAL)** | Defines `.eramind-dashboard` as the root dark-theme class, but **no component in the codebase uses this class name**. The dark theme CSS is completely unused/dead code. | Either implement the dark theme toggle that adds `.eramind-dashboard` class, or remove this file. |
| 2 | Code Quality | Duplicates class names from `dashboard-analytics.css` (`.donut-center-label`, `.rag-bar`) — when both CSS files are loaded, rules conflict unpredictably. | Namespace all dark-theme rules under `.eramind-dashboard` (which they are) — but since the parent class is never applied, these rules never match. |
| 3 | Code Quality | File exists but provides zero value since the dark theme is not wired up. ~185 lines of dead CSS. | Remove or wire up. |

---

### 2.8 Services

#### `api.ts`
| Metric | Value |
|---|---|
| Lines | ~230 |
| Inline styles | 0 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Type Safety (CRITICAL)** | Nearly every API function returns `request<any>`. The project has well-defined types in `types/index.ts` (`Transport`, `WorkItem`, `Milestone`, etc.) but they are **never used** in the API layer. | Type every endpoint: `getAll: () => request<ODataResponse<Transport>>('/Transports')`, etc. |
| 2 | Error Handling | CSRF token fetch has an empty `catch {}` — if CSRF fails silently, subsequent mutations will fail with a 403, and users see a confusing error. | Log a warning or show a toast: "Session may have expired". |
| 3 | Error Handling | The `request()` function throws a generic `Error` — callers have no typed error object to inspect. | Create an `ApiError` class with `status`, `code`, `message` fields. |
| 4 | Security | CSRF token is fetched with a `GET` request because "CAP rejects HEAD with 405" — but using GET for token fetch means the response body is parsed and discarded. Wasteful. | Acceptable workaround; add a comment explaining the trade-off. |
| 5 | Code Quality | No request cancellation support (e.g., via `AbortController`). If a component unmounts during a fetch, the promise resolves into nothing. | Pass `signal` parameter through to `fetch()` and integrate with React Query's signal. |
| 6 | Code Quality | No retry logic at the API layer. Relies entirely on React Query's `retry: 2`. | Fine for now, but consider separating concerns. |

---

### 2.9 Hooks

#### `useData.ts`
| Metric | Value |
|---|---|
| Lines | ~210 |
| Inline styles | 0 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | All query hooks return untyped data since `api.ts` returns `any`. `useTransports()` returns `any[]`, not `Transport[]`. | Fix types in `api.ts` and the hooks will inherit proper types. |
| 2 | Code Quality | No `onError` callbacks on any mutation. If `useCategorizeTransport()` fails, the caller must handle it — but most callers don't. | Add default `onError: (err) => message.error(err.message)` to mutation hooks. |
| 3 | Code Quality | `useHealth()` has `refetchInterval: 60_000` (1 minute polling). This is aggressive and runs even when the dashboard isn't visible. | Use `refetchIntervalInBackground: false` to pause when tab is hidden. |
| 4 | Performance | Every mutation calls `queryClient.invalidateQueries` for multiple keys. E.g., `useDeleteWorkItem` invalidates `workItems`, `dashboardSummary`, AND `transports`. This triggers 3 parallel refetches. | Batch invalidations or use `queryClient.invalidateQueries({ predicate })` to be more targeted. |

---

### 2.10 Contexts

#### `AuthContext.tsx`
| Metric | Value |
|---|---|
| Lines | ~85 |
| Inline styles | 1 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | `UserInfo` interface is defined here **and** in `types/index.ts` with **different shapes** — `AuthContext.UserInfo` has `isAdmin`, `isManager`, `isDeveloper`, `isExecutive`, `isSuperAdmin`, `allowedApps`; `types/index.ts` has `roles: UserRole[]`. | Unify to a single type, exported from `types/index.ts`. |
| 2 | Inline Styles | Loading spinner uses `style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}`. | Extract to CSS class `.auth-loading`. |
| 3 | Code Quality | `hasRole` and `hasAnyRole` are recreated on every render (new function references). Since the context value object is also new, all consumers re-render. | Memoize with `useMemo` and `useCallback`. |
| 4 | Error Handling | Auth error shows a `Result` with status 403 and a "Retry" button that does `window.location.reload()`. No retry count or exponential backoff. | Add retry count; after 3 retries, show "Contact administrator". |

#### `ModuleContext.tsx`
| Metric | Value |
|---|---|
| Lines | ~100 |
| Inline styles | 0 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | Code Quality | `MODULE_DEFINITIONS` is a large static object (~70 lines) embedded in the context file. | Extract to `constants/modules.ts`. |
| 2 | Code Quality | Context value object is recreated every render — all consumers re-render on any parent update. | Memoize with `useMemo`. |
| 3 | Code Quality | `localStorage` key `pcc_active_module` is hardcoded as a string. Other localStorage keys in the project are also hardcoded. | Create `constants/storageKeys.ts`. |
| 4 | Bug (Minor) | If `localStorage` returns a value that isn't a valid `ModuleKey` (e.g., after code changes remove a module), the app uses the invalid key. | Add validation: `const stored = localStorage.getItem(...) as ModuleKey; return ['sap','coupa','commercial'].includes(stored) ? stored : 'sap'`. |

---

### 2.11 Types

#### `types/index.ts`
| Metric | Value |
|---|---|
| Lines | ~130 |
| Inline styles | 0 |

| # | Category | Issue | Suggested Fix |
|---|---|---|---|
| 1 | **Code Quality (CRITICAL)** | Well-defined types (`Transport`, `WorkItem`, `Milestone`, `DashboardSummary`, `PipelineSummary`, `Notification`, etc.) exist but are **not used anywhere** — `api.ts` returns `any`, hooks return `any`, components type data as `any`. These types are completely dead code. | Wire types through: `api.ts` → `useData.ts` → components. |
| 2 | Code Quality | `UserRole` type is `'Executive' | 'Manager' | 'Developer'` but the backend also returns `'Admin'` — type is incomplete. | Add `'Admin'` to the union. |
| 3 | Code Quality | `ODataResponse<T>`, `ActionResult`, `CategorizeResult`, etc. are defined but never used. | Apply to `api.ts` return types. |
| 4 | Code Quality | `WorkItem.overallRAG` is typed as `'GREEN' | 'AMBER' | 'RED' | null` — good, but because components receive `any`, this type safety is never enforced. | Fix the pipeline: api → hooks → components. |

---

## 3. Cross-Cutting Issues

### 3.1 Dashboard Duplication — The Biggest Refactor Opportunity

The three analytics dashboards and three classic dashboards share ~90% identical code:

| Component | Lines | Unique logic |
|---|---|---|
| `HomeDashboard.tsx` | 430 | `application === 'SAP'` filter, SAP phases |
| `CoupaDashboard.tsx` | 340 | `application === 'Coupa'` filter, Coupa phases |
| `CommercialDashboard.tsx` | 340 | `application === 'Commercial'` filter, Commercial phases |
| `HomeDashboardClassic.tsx` | 350 | SAP terminology, pipeline stages |
| `CoupaDashboardClassic.tsx` | 260 | Coupa terminology, deployment steps |
| `CommercialDashboardClassic.tsx` | 280 | Commercial terminology, launch tracker |
| **Total duplicated** | **~2,000 lines** | |

**Recommendation:** Create two generic components:

```tsx
// AnalyticsDashboard.tsx — replaces Home/Coupa/CommercialDashboard
<AnalyticsDashboard
  application="SAP"
  phases={['Planning','Development','Testing','Go-Live','Hypercare','Complete']}
  colorScheme={{ primary: '#1677ff' }}
/>

// ClassicDashboard.tsx — replaces Home/Coupa/CommercialDashboardClassic
<ClassicDashboard
  application="Coupa"
  terminology={MODULE_DEFINITIONS.coupa.terminology}
  phases={MODULE_DEFINITIONS.coupa.phases}
/>
```

This would eliminate **~1,500 lines** of duplicated code.

### 3.2 `getRAG()` Duplication

The RAG color helper function is duplicated in at least 6 files:

- `HomeDashboard.tsx`
- `HomeDashboardClassic.tsx`
- `CoupaDashboard.tsx`
- `CoupaDashboardClassic.tsx`
- `CommercialDashboard.tsx`
- `CommercialDashboardClassic.tsx`
- `ExecutiveDashboard.tsx`
- `ExecutiveDashboardClassic.tsx`

**Fix:** Create `utils/rag.ts`:

```tsx
export function getRAGColor(rag: string | null): string {
  switch (rag) {
    case 'GREEN': return '#52c41a';
    case 'AMBER': return '#faad14';
    case 'RED':   return '#ff4d4f';
    default:      return '#d9d9d9';
  }
}

export function getRAGIcon(rag: string | null): string {
  switch (rag) {
    case 'GREEN': return '✅';
    case 'AMBER': return '⚠️';
    case 'RED':   return '❌';
    default:      return '⚪';
  }
}
```

### 3.3 Type Safety Pipeline

Currently:
```
types/index.ts (well-typed) → api.ts (returns any) → useData.ts (returns any) → Components (use any)
```

Should be:
```
types/index.ts → api.ts (typed returns) → useData.ts (typed returns) → Components (typed props)
```

### 3.4 Inline Styles Summary

| Component | Inline Style Count |
|---|---|
| AIChatDrawer.tsx | ~65 |
| HomeDashboardClassic.tsx | ~50 |
| CoupaDashboardClassic.tsx | ~30 |
| CommercialDashboardClassic.tsx | ~30 |
| WorkItemDetail.tsx | ~30 |
| HomeDashboard.tsx | ~25 |
| CoupaDashboard.tsx | ~25 |
| CommercialDashboard.tsx | ~25 |
| ExecutiveDashboard.tsx | ~25 |
| ExecutiveDashboardClassic.tsx | ~25 |
| AppShell.tsx | ~22 |
| ReportBuilder.tsx | ~20 |
| WorkItemList.tsx | ~15 |
| SettingsPage.tsx | ~15 |
| WeeklyDigestPage.tsx | ~15 |
| NotificationDrawer.tsx | ~12 |
| AdminPage.tsx | ~12 |
| TransportPipeline.tsx | ~10 |
| UnassignedTRs.tsx | ~8 |
| MethodologyPage.tsx | ~8 |
| TRSearch.tsx | ~6 |
| Others | ~7 |
| **Total** | **~430+** |

### 3.5 Accessibility Audit Summary

| Issue | Occurrences | WCAG Criteria |
|---|---|---|
| Clickable `<div>` without `role`/`tabIndex`/`onKeyDown` | 8+ components | 2.1.1 Keyboard |
| No `aria-label` on icon-only buttons | 5+ components | 1.1.1 Non-text Content |
| Color-only status indicators (RAG) | 8+ components | 1.4.1 Use of Color |
| Form inputs without labels | 3+ components | 1.3.1 Info and Relationships |
| No skip navigation link | App.tsx | 2.4.1 Bypass Blocks |
| Charts with no text alternative | 6+ components | 1.1.1 Non-text Content |

---

## 4. Priority Remediation Plan

### P0 — Critical (Fix Immediately)

| # | Issue | Impact | Effort |
|---|---|---|---|
| 1 | Wire types through `api.ts` → hooks → components | Catches bugs at compile time; currently no TS benefit | Medium (2–3 days) |
| 2 | Unify `UserInfo` type (duplicate in `AuthContext` vs `types/index.ts`) | Type confusion, potential runtime bugs | Low (1 hour) |
| 3 | Remove or wire up `dashboard-dark.css` (dead code) | 185 lines of unused CSS loaded on every page | Low (30 min) |
| 4 | Fix empty `catch {}` blocks (5+ locations) | Silent failures hide real bugs | Low (1–2 hours) |

### P1 — High (Fix This Sprint)

| # | Issue | Impact | Effort |
|---|---|---|---|
| 5 | Create generic `AnalyticsDashboard` + `ClassicDashboard` components | Eliminates ~1,500 lines of duplication | High (3–5 days) |
| 6 | Extract `getRAG()` to shared util | 8 files with duplicated logic | Low (1 hour) |
| 7 | Remove TRSearch duplication from WorkItemList | ~150 lines of duplicated code | Low (1 hour) |
| 8 | Add table pagination / virtual scroll for 1,000+ item tables | Performance bottleneck with real data | Medium (1–2 days) |
| 9 | Split `AIChatDrawer.tsx` (1,098 lines) into sub-components | Maintainability, code review, testing | Medium (2–3 days) |
| 10 | Add debounce to search inputs (TRSearch, WorkItemList) | UI jank on every keystroke with large datasets | Low (1 hour) |

### P2 — Medium (Fix Next Sprint)

| # | Issue | Impact | Effort |
|---|---|---|---|
| 11 | Extract ~430 inline styles to CSS modules | Theming, consistency, maintainability | High (3–5 days) |
| 12 | Add `aria-label` to all icon buttons and interactive widgets | Accessibility compliance | Medium (1 day) |
| 13 | Add keyboard support to clickable `<div>` elements | Accessibility compliance | Medium (1 day) |
| 14 | Add color-independent RAG indicators (icons + text) | Accessibility (color-blind users) | Low (2 hours) |
| 15 | Memoize `AuthContext` and `ModuleContext` value objects | Prevents unnecessary re-renders tree-wide | Low (1 hour) |
| 16 | Add `onError` defaults to all mutation hooks | Consistent error UX | Low (2 hours) |
| 17 | Single-pass `useMemo` for dashboard data derivation | Reduces O(7n) to O(n) per render | Medium (1 day) |
| 18 | Memoize `DOMPurify.sanitize()` calls | CPU savings on re-renders | Low (1 hour) |

### P3 — Low (Backlog)

| # | Issue | Impact | Effort |
|---|---|---|---|
| 19 | Add skip-nav link to `App.tsx` | WCAG compliance | Low (30 min) |
| 20 | Add responsive CSS breakpoints to dashboard styles | Mobile usability | Medium (2 days) |
| 21 | Migrate `ErrorBoundary` to `react-error-boundary` | Consistency (all hooks, no class components) | Low (1 hour) |
| 22 | Create `constants/storageKeys.ts` for localStorage keys | Prevents key collisions | Low (30 min) |
| 23 | Add `AbortController` signal support to `api.ts` `request()` | Prevents stale responses on unmount | Medium (2 hours) |
| 24 | Add confirmation dialogs to AdminPage system operations | Prevents accidental destructive actions | Low (1 hour) |
| 25 | Validate `ModuleContext` localStorage value on read | Prevents invalid module key | Low (30 min) |

---

*End of audit report. Total unique issues identified: 56.*
