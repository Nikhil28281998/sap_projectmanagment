# Premium Design Overhaul — Design Spec

- **Date:** 2026-04-20
- **Owner:** Nikhil Kumar (BridgeBio SAP PMO)
- **Design lead:** Claude (acting as design systems lead)
- **Project:** `sap_projectmanagment` — Transport Command Center
- **Status:** Draft, pending user approval

---

## 1. Purpose

Re-platform the frontend of the Transport Command Center onto a production-grade design system that delivers (a) executive-credible visual quality, (b) a maintainable token-driven foundation, and (c) the architectural consolidation called out in [FRONTEND-AUDIT-REPORT.md](../../../FRONTEND-AUDIT-REPORT.md).

This is a **frontend-only re-platform**. No backend, data model, or feature changes.

## 2. Problem Statement

The current React frontend works but is brittle and visually unfinished:

| Issue | Source | Consequence |
|---|---|---|
| 430+ inline `style={{}}` objects | Audit | Theming, dark mode, brand changes are impossible |
| Widespread `any` types | Audit | Silent regressions; refactor-hostile |
| Three near-duplicate dashboards (Home, Coupa, Commercial) | Audit | 3× maintenance, drift |
| No table virtualization | Audit | UI degrades past ~1000 TRs |
| No skeleton loaders / empty states | Audit | Feels unfinished on slow networks |
| WCAG AA gaps (ARIA, focus, contrast) | Audit | Not executive- or compliance-ready |
| AntD icons inconsistent with any design language | Observation | Looks generic |

## 3. Goals & Non-Goals

### Goals
1. Zero inline styles; every visual property flows from tokens.
2. Dark-first default with a first-class light mode; theme switch < 100ms, no layout shift.
3. Single `Dashboard` component driven by configuration, replacing the three duplicates.
4. Virtualized tables that handle ≥10,000 rows at 60fps.
5. WCAG 2.1 AA compliance verified via axe + manual.
6. TypeScript strict in `design/` and `features/`; no `any` in new code.
7. Enforcement layer (ESLint + types + stylelint) that prevents regression.

### Non-Goals
- No changes to CAP services, CDS schema, OData endpoints, RFC/SharePoint integrations, or AI client logic.
- No new product features.
- No framework swap (AntD 5 stays).
- No change to the approuter build-output contract (`approuter/webapp/`).

## 4. Style Direction

**Hybrid: dark-first "Command Center" + matching light mode,** unified through one token system.

| Aspect | Dark | Light |
|---|---|---|
| Base surface | `#0B1220` → `#1A2338` (slate/navy gradient) | `#FFFFFF` / `#F7F8FA` (paper) |
| Primary accent | Teal `#22D3EE` | Ink blue `#1E40AF` |
| Status — Red/Amber/Green | Rose `#F43F5E` / Amber `#F59E0B` / Emerald `#10B981` | Same hue, AA-compliant tints |
| Border | `rgba(148,163,184,0.12)` | `#E5E7EB` |
| Typography | Inter Variable (UI) + JetBrains Mono (TR numbers, codes) | same |
| Density modes | Comfortable / Compact / Dense | same |
| Motion | 150–250ms ease-out | same |

**Theme transport:** CSS custom properties emitted on `:root[data-theme="dark"]` and `:root[data-theme="light"]`. Theme switch = single attribute change; no React re-render.

**Reference aesthetics:** Linear, Vercel, Height (dark); Notion, McKinsey (light). We are not cloning — we are calibrating to that bar.

## 5. Architecture

### 5.1 New Top-Level Structure

```
frontend/src/
├── design/
│   ├── tokens/              # Single source of truth
│   │   ├── color.ts         # primitive palette → semantic tokens
│   │   ├── typography.ts    # font stacks, scale, leading
│   │   ├── spacing.ts       # 4px base grid, named steps
│   │   ├── radius.ts
│   │   ├── shadow.ts
│   │   ├── motion.ts
│   │   ├── z-index.ts
│   │   ├── density.ts
│   │   └── index.ts
│   ├── theme/
│   │   ├── antdTheme.ts     # maps tokens → AntD ConfigProvider
│   │   ├── cssVars.ts       # emits tokens as CSS variables
│   │   └── ThemeProvider.tsx # wraps app, handles data-theme toggle
│   ├── primitives/
│   │   ├── Stack.tsx        # vertical layout
│   │   ├── Inline.tsx       # horizontal layout
│   │   ├── Box.tsx          # token-only style prop (no raw CSS)
│   │   └── Text.tsx         # typography primitive
│   ├── components/
│   │   ├── StatCard/
│   │   ├── StatusChip/
│   │   ├── DataTable/       # virtualized
│   │   ├── PageHeader/
│   │   ├── SectionCard/
│   │   ├── SkeletonPanel/
│   │   ├── EmptyState/
│   │   ├── Timeline/
│   │   ├── RiskMeter/
│   │   ├── UserAvatar/
│   │   └── index.ts
│   ├── icons/               # Lucide re-exports, curated set
│   ├── motion/              # shared transition presets
│   └── global.css
├── app/
│   ├── shell/               # AppShell, Sidebar, TopBar, CommandPalette
│   ├── providers/           # Theme, Query, Auth, AI context
│   ├── routes.tsx
│   └── main.tsx
├── features/                # by feature, not by type
│   ├── dashboard/           # ONE component, config-driven
│   ├── pipeline/
│   ├── workitems/
│   ├── tr-search/
│   ├── reports/
│   ├── settings/
│   └── admin/
├── lib/                     # non-visual utilities
└── types/                   # shared TS types
```

### 5.2 Token Architecture (three layers)

1. **Primitive tokens** — raw values, never consumed by components directly.
   Example: `blue.500 = #22D3EE`, `slate.900 = #0B1220`.

2. **Semantic tokens** — role-based, theme-aware, consumed by components.
   Example: `color.bg.surface`, `color.text.primary`, `color.status.risk.high`.

3. **Component tokens** — component-scoped overrides.
   Example: `statCard.bg`, `dataTable.rowHover`.

Semantic and component tokens flip between themes. Primitive tokens do not.

### 5.3 Theme Transport

- Tokens serialized to CSS variables on `:root[data-theme="dark|light"]` at build time.
- AntD consumes the same tokens via `ConfigProvider` `theme` prop (JS object).
- Custom components consume via `var(--color-bg-surface)`.
- Theme switch: `document.documentElement.dataset.theme = 'light'` — CSS handles the rest. No React re-render.
- Density and reduced-motion handled the same way: `data-density`, `prefers-reduced-motion`.

### 5.4 Dashboard Consolidation

Current: `Home.tsx`, `Coupa.tsx`, `Commercial.tsx` — three near-duplicates.

Target: one `<Dashboard config={…} />` driven by a config object:

```ts
type DashboardConfig = {
  id: 'home' | 'coupa' | 'commercial' | 'executive';
  title: string;
  filters: FilterDef[];        // e.g. { module: 'Coupa' }
  layout: LayoutSection[];     // rows of StatCards, charts, tables
  permissions?: Scope[];
}
```

Each persona's dashboard is a JSON/TS config, not a new component.

### 5.5 Enforcement Layer

- **ESLint:** `react/forbid-dom-props` bans `style=`, custom rule bans raw hex in JSX.
- **TypeScript:** `<Box bg="…" p="…" />` props typed as keyof token table → hex literals won't compile.
- **stylelint:** blocks raw colors and spacings in CSS files.
- **CI:** these rules run on every PR; violations block merge.

## 6. Component Catalogue (first wave)

| Component | Purpose | Replaces |
|---|---|---|
| `StatCard` | Exec KPI tile — value, delta, sparkline, status | Ad-hoc card markup in 3 dashboards |
| `StatusChip` | RAG + Blocked/At-Risk states | Inline-colored `<Tag>` usage |
| `DataTable` | Virtualized, sortable, filterable wrapper over AntD Table | Raw AntD Tables |
| `PageHeader` | Breadcrumbs, title, actions, meta | Hand-rolled headers |
| `SectionCard` | Content container | `<Card>` with inline padding |
| `SkeletonPanel` / `SkeletonTable` | Loading states | None (loading is currently blank) |
| `EmptyState` | Illustration + message + CTA | None |
| `Timeline` | Milestone rail | Custom markup in Work Item Detail |
| `RiskMeter` | 0–100 gauge | Plain number display |
| `UserAvatar` / `UserChip` | Identity | Text-only owner names |

## 7. Phased Delivery

Each phase leaves the app shippable.

### Phase 0 — Foundation (est. 3 days)
- Install deps: `@tanstack/react-virtual`, `lucide-react`, `inter-ui` (variable), `@vanilla-extract/css` or plain CSS modules (decision in implementation plan).
- Build token system (`design/tokens/`) + CSS var emitter.
- Wire AntD `ConfigProvider` to dark-first theme.
- Add `ThemeProvider` + theme/density toggles in memory only (no UI yet).
- **Gate:** Theme switch works in a sandbox route; no visible change to existing pages.

### Phase 1 — Enforcement + Primitives (est. 3 days)
- Add ESLint rule banning inline `style=`.
- Add `stylelint` for CSS files.
- Build `Stack`, `Inline`, `Box`, `Text` primitives.
- Migrate App Shell (sidebar, top bar) to primitives as a reference.
- **Gate:** Lint passes on touched files; shell visually improved.

### Phase 2 — Core Components (est. 5 days)
- Build the 10 components in §6.
- Each with: token-only styling, strict TS, axe test, a11y review.
- Add a `/design-system` internal route that renders every component in both themes (in-app docs).
- **Gate:** `/design-system` route renders all components clean; axe clean.

### Phase 3 — Flagship: Home Dashboard (est. 4 days)
- Rebuild Home dashboard end-to-end using tokens + primitives + components.
- Introduce `DashboardConfig` type; Home is the first config.
- **Gate:** Home dashboard passes visual review and Lighthouse (perf ≥ 90, a11y ≥ 95).

### Phase 4 — Remaining Pages (est. 10 days)
In priority order:
1. Transport Pipeline (Kanban-style DEV→QAS→PRD)
2. Work Items List + Detail (with virtualized list, tabbed detail)
3. Unassigned TRs, TR Search
4. Report Builder (wizard + live preview)
5. Settings, Admin
6. Coupa and Commercial dashboards (new `DashboardConfig`s — prove consolidation)
- **Gate:** All pages migrated; zero inline styles remain; three-dashboard duplicates deleted.

### Phase 5 — Performance & Polish (est. 4 days)
- Route-level code splitting.
- Chart theming (AntD Charts tokens).
- Motion polish: page transitions, skeleton → content crossfade.
- Icon audit: migrate remaining AntD icons to Lucide where inconsistent.
- **Gate:** Lighthouse ≥ 90 perf site-wide.

### Phase 6 — Accessibility & QA (est. 3 days)
- axe-core integrated into Vitest + Playwright suites.
- Manual NVDA + VoiceOver pass.
- Keyboard-only nav audit.
- Reduced-motion honored throughout.
- **Gate:** Zero axe critical/serious; WCAG 2.1 AA sign-off.

**Total estimate: ~32 working days (6–7 weeks).** Single-contributor. Phases are independently shippable and reviewable.

## 8. Success Metrics (Definition of Done)

| Metric | Target | How measured |
|---|---|---|
| Inline `style={{}}` occurrences | 0 | ESLint count |
| `any` types in `design/` + `features/` | 0 | `tsc --strict` |
| Dashboard components | 1 (was 3) | File count |
| Lighthouse Performance | ≥ 90 on every page | CI Lighthouse |
| Lighthouse Accessibility | ≥ 95 on every page | CI Lighthouse |
| axe critical/serious violations | 0 | axe in Playwright |
| Theme switch latency | < 100ms, 0 CLS | Manual + Chrome perf |
| Large-table interaction FPS | 60fps at 10,000 rows | Chrome perf trace |
| Keyboard-reachable actions | 100% | Manual audit |

## 9. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Token system over-engineered early | Medium | Start with tokens we need; expand when a second consumer appears |
| AntD 5 minor upgrade breaks theme | Low | Pin minor version; theme tested in sandbox route first |
| Big-bang migration stalls feature work | Medium | Phase gates — each phase ships |
| Chart library (AntD Charts) resists theming | Medium | Phase 5 dedicated to chart theme; fallback to recharts if blocked |
| Dashboard config becomes its own leaky abstraction | Medium | Keep config declarative, not conditional-heavy; revisit after two personas shipped |
| `db.sqlite` checked into git (separate issue) | — | Flag to backend owner; not blocking |

## 10. Out-of-Scope / Future Work

- Mobile/responsive redesign (current app is desktop-first; flag for a follow-up spec).
- Replacing AntD with shadcn/Radix (separate initiative).
- Chart library swap.
- Design system extraction into its own package.
- Backend performance work (SQLite vs HANA parity).

## 11. Open Questions

None blocking. All decisions locked in §4–§7 above.

## 12. Approval

- [ ] Client (Nikhil Kumar) sign-off on style direction (§4)
- [ ] Client sign-off on scope boundaries (§3 non-goals)
- [ ] Client sign-off on phased plan (§7)

On approval, the next step is an implementation plan produced via the `writing-plans` skill.
