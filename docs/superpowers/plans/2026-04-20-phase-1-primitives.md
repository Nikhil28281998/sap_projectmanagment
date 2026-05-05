# Phase 1 — Layout Primitives + Inline-Style Ban

> **Goal:** Ship token-only layout primitives (`Box`, `Stack`, `Inline`, `Text`) and an ESLint rule that prevents new inline `style={{}}` usage — so future component work is token-driven by default.

**Tech:** React 18, TypeScript strict, existing design tokens at `frontend/src/design/tokens/`.

**Working dir:** `c:/Users/NikhilKumar-EXT/Claude Projects/PM Project/sap_projectmanagment/frontend/`

**Scope for this plan (Phase 1a — Foundation):**
Build the four primitives, enforce the rule, refactor the design sandbox as a reference consumer. Bulk migration of existing 430+ inline styles is **Phase 1b** (per-feature as pages are touched; not this plan).

---

## File structure created

```
frontend/src/design/primitives/
├── Box.tsx           # single-responsibility base: token-only style props
├── Stack.tsx         # vertical flex with token gap
├── Inline.tsx        # horizontal flex with token gap + wrap + align
├── Text.tsx          # typography primitive (uses scale tokens)
├── __tests__/
│   ├── Box.test.tsx
│   ├── Stack.test.tsx
│   ├── Inline.test.tsx
│   └── Text.test.tsx
└── index.ts          # barrel
```

**Files modified:**
- `frontend/.eslintrc.cjs` — add rule banning inline `style=` (warning in phase 1a, will be promoted to error in phase 1b)
- `frontend/src/design/sandbox/DesignSystemSandbox.tsx` — refactor to use new primitives as reference

---

## Task 1 — Box primitive (TDD)

Create `frontend/src/design/primitives/Box.tsx`:

- Props: `as?: ElementType`, `p/px/py/pt/pr/pb/pl?: SpacingToken`, `m/mx/my/mt/mr/mb/ml?: SpacingToken`, `bg?: 'app'|'elevated'|'raised'|'surface'|'surface-subtle'|'surface-muted'`, `radius?: RadiusToken`, `shadow?: ShadowToken`, `border?: 'subtle'|'default'|'strong'`, `color?: 'primary'|'secondary'|'muted'|'inverse'`.
- All props map to CSS variables via className/style composition (style allowed *inside* Box because Box itself is the token-to-style adapter — the ESLint rule will allowlist `design/primitives/`).
- No hex codes. No raw CSS values outside token tables.

Commit: `feat(design): add Box primitive (token-only base layout)`

---

## Task 2 — Stack primitive (TDD)

Wraps `Box` with `display: flex; flex-direction: column`. Extra props: `gap?: SpacingToken`, `align?: 'start'|'center'|'end'|'stretch'`, `justify?: 'start'|'center'|'end'|'between'|'around'`.

Commit: `feat(design): add Stack primitive (vertical flex layout)`

---

## Task 3 — Inline primitive (TDD)

Wraps `Box` with `display: flex; flex-direction: row`. Extra: `gap`, `align`, `justify`, `wrap?: boolean`.

Commit: `feat(design): add Inline primitive (horizontal flex layout)`

---

## Task 4 — Text primitive (TDD)

Props: `as?: 'span'|'p'|'h1'|'h2'|'h3'|'h4'|'div'`, `variant?: TypographyScale`, `color?: semantic text key`, `weight?: 'regular'|'medium'|'semibold'|'bold'`, `mono?: boolean`, `align?: 'left'|'center'|'right'`, `truncate?: boolean`.

Commit: `feat(design): add Text primitive (typography via scale tokens)`

---

## Task 5 — Primitives barrel

Create `frontend/src/design/primitives/index.ts` exporting all four.

Commit: `feat(design): primitives barrel export`

---

## Task 6 — ESLint rule banning inline style=

Update `frontend/.eslintrc.cjs`:

```js
'react/forbid-component-props': ['warn', {
  forbid: [{ propName: 'style', message: 'Use design primitives (Box/Stack/Inline) or CSS classes. Inline styles bypass tokens and theming.' }]
}],
'react/forbid-dom-props': ['warn', {
  forbid: [{ propName: 'style', message: 'Use design primitives (Box/Stack/Inline) or CSS classes.' }]
}],
```

Scope: warning (not error) in Phase 1a so it doesn't block CI. Allowlist `src/design/primitives/**` via an override. Phase 1b will promote to error after the bulk migration.

Install `eslint-plugin-react` if not already present (it usually is via `plugin:react-hooks/recommended`).

Commit: `feat(lint): warn on inline style= in JSX (allow in design/primitives/)`

---

## Task 7 — Refactor DesignSystemSandbox to use primitives

Replace inline `style={{ padding: 'var(--space-6)', ... }}` in `DesignSystemSandbox.tsx` with `<Stack gap={6} p={6}>`, `<Inline gap={2}>`, etc. Sandbox becomes the reference consumer.

Commit: `refactor(design): DesignSystemSandbox uses Stack/Inline/Box (no inline style)`

---

## Phase 1b — Bulk migration (separate plan)

Not included in this plan. Ad-hoc migration of existing 430+ inline styles will happen as pages are touched in Phase 2–4. When all inline `style=` occurrences outside primitives are zero, promote the ESLint rule from `warn` to `error`.
