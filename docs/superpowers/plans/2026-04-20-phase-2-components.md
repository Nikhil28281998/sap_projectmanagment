# Phase 2 — Core Component Library

> **Goal:** Build 8 token-driven, a11y-checked, TDD-tested components that replace ad-hoc card/tag/empty-state/header markup across the app. Foundation for Phase 3-4 page redesigns.

**Scope this plan:** StatCard, StatusChip, EmptyState, SectionCard, PageHeader, SkeletonPanel, RiskMeter, UserAvatar.
**Deferred to Phase 2b:** DataTable (needs virtualization research), Timeline (needs milestone-specific logic).

## Files created

```
frontend/src/design/components/
├── StatCard.tsx          # KPI tile: label, value, delta, status tone
├── StatusChip.tsx        # RAG + Blocked/At-Risk chip
├── EmptyState.tsx        # icon + title + description + CTA
├── SectionCard.tsx       # consistent content container (token padding/radius/bg)
├── PageHeader.tsx        # breadcrumb + title + description + actions
├── SkeletonPanel.tsx     # loading skeleton for card/list/table patterns
├── RiskMeter.tsx         # 0–100 risk score gauge (colored)
├── UserAvatar.tsx        # initials + role badge + name
├── __tests__/*.test.tsx  # one test file per component
└── index.ts              # barrel
```

## Design rules
- Every component uses design tokens only — no raw hex, no raw px in JSX.
- Each accepts a `className` + `data-testid` for consumer customization.
- TypeScript strict. No `any`.
- At least 3 behavior tests per component.
- A11y: semantic HTML (proper heading levels, roles, aria-labels).
- Each component under 200 LOC.

## Tasks
(One commit per component + one for the barrel. 9 commits total.)

1. StatCard
2. StatusChip
3. EmptyState
4. SectionCard
5. PageHeader
6. SkeletonPanel
7. RiskMeter
8. UserAvatar
9. Barrel + final verification

## Verification gates
- `npx tsc --noEmit` clean
- `npx vitest run src/design/` all green (≥ 71 + ≥ 24 new = ≥ 95 tests)
- Each component rendered in `/design-sandbox` for both dark + light themes

## Out of scope
- DataTable (virtualization, sort, filter — its own plan)
- Timeline (milestone-specific)
- Integrating components into existing dashboards (Phase 3/4 work)
