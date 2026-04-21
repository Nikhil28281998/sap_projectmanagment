# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the token + theme + CSS-variable foundation for the premium design overhaul, with a sandbox route proving theme switching works — without visually changing any existing page.

**Architecture:** Three-layer tokens (primitive → semantic → component) emitted as CSS custom properties on `:root[data-theme]`. AntD 5 `ConfigProvider` consumes the same tokens via a JS theme object. A new `ThemeProvider` React component flips `data-theme` on `<html>`. No React re-renders on theme switch. Existing pages continue to use the old `main.tsx` AntD config until Phase 1 migrates them.

**Tech Stack:** React 18.3, TypeScript 5.4 (strict), Ant Design 5.15, Vite 5.1, Vitest 1.3 (+ Testing Library), Lucide React (new), Inter Variable font (new).

**Spec:** `docs/superpowers/specs/2026-04-20-premium-design-overhaul-design.md`

**Working directory for all commands:** `c:/Users/NikhilKumar-EXT/Claude Projects/PM Project/sap_projectmanagment/frontend/`

**Phase 0 scope:** Tasks 1–13 below. Does NOT include migrating existing pages, adding ESLint rules banning `style=`, or building component library — those are Phase 1/2 plans.

---

## File Structure (created in Phase 0)

```
frontend/src/design/
├── tokens/
│   ├── primitives.ts        # raw palette, never themed
│   ├── semantic.ts          # theme-aware semantic tokens (dark + light)
│   ├── spacing.ts           # 4px base grid
│   ├── typography.ts        # font stacks, scale, leading
│   ├── radius.ts
│   ├── shadow.ts
│   ├── motion.ts
│   ├── zIndex.ts
│   ├── density.ts
│   └── index.ts             # barrel
├── theme/
│   ├── cssVars.ts           # token → CSS var name + value serializer
│   ├── antdTheme.ts         # tokens → AntD ConfigProvider theme (dark + light)
│   ├── ThemeProvider.tsx    # React provider, flips data-theme on <html>
│   ├── useTheme.ts          # hook to read/set theme + density
│   └── index.ts             # barrel
├── global.css               # base reset + :root CSS var definitions
└── sandbox/
    └── DesignSystemSandbox.tsx  # dev-only route showing tokens + theme toggle
```

**Files modified:**
- `frontend/package.json` — add `lucide-react`, `@fontsource-variable/inter`, `@fontsource/jetbrains-mono`
- `frontend/src/main.tsx` — wrap app with new `ThemeProvider`; keep existing `ConfigProvider` call inside
- `frontend/src/App.tsx` — add `/design-sandbox` route (dev-only)
- `frontend/src/test/setup.ts` — add token import sanity if needed

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install Lucide icons and font packages**

Run from `frontend/`:

```bash
npm install lucide-react@^0.400.0 @fontsource-variable/inter@^5.0.0 @fontsource/jetbrains-mono@^5.0.0
```

Expected: installs without errors, `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Verify install**

Run:

```bash
npm ls lucide-react @fontsource-variable/inter @fontsource/jetbrains-mono
```

Expected: all three packages resolve with versions.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add lucide-react and variable fonts for design system"
```

---

## Task 2: Primitive color + non-color tokens

**Files:**
- Create: `frontend/src/design/tokens/primitives.ts`
- Create: `frontend/src/design/tokens/spacing.ts`
- Create: `frontend/src/design/tokens/radius.ts`
- Create: `frontend/src/design/tokens/shadow.ts`
- Create: `frontend/src/design/tokens/motion.ts`
- Create: `frontend/src/design/tokens/zIndex.ts`
- Test: `frontend/src/design/tokens/__tests__/primitives.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/tokens/__tests__/primitives.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { primitives } from '../primitives';
import { spacing } from '../spacing';
import { radius } from '../radius';
import { shadow } from '../shadow';
import { motion } from '../motion';
import { zIndex } from '../zIndex';

describe('primitive tokens', () => {
  it('has a full slate scale 50–950', () => {
    expect(primitives.slate[50]).toBeDefined();
    expect(primitives.slate[900]).toBeDefined();
    expect(primitives.slate[950]).toBeDefined();
  });

  it('has teal, rose, amber, emerald, inkBlue scales', () => {
    expect(primitives.teal[500]).toBe('#22D3EE');
    expect(primitives.rose[500]).toBe('#F43F5E');
    expect(primitives.amber[500]).toBe('#F59E0B');
    expect(primitives.emerald[500]).toBe('#10B981');
    expect(primitives.inkBlue[700]).toBe('#1E40AF');
  });
});

describe('spacing tokens', () => {
  it('is a 4px base grid', () => {
    expect(spacing[1]).toBe('4px');
    expect(spacing[2]).toBe('8px');
    expect(spacing[4]).toBe('16px');
    expect(spacing[8]).toBe('32px');
  });
});

describe('radius tokens', () => {
  it('exposes sm/md/lg/xl/pill', () => {
    expect(radius.sm).toBe('4px');
    expect(radius.md).toBe('6px');
    expect(radius.lg).toBe('10px');
    expect(radius.xl).toBe('16px');
    expect(radius.pill).toBe('9999px');
  });
});

describe('shadow tokens', () => {
  it('exposes sm/md/lg/xl for both themes', () => {
    expect(shadow.dark.md).toContain('rgba');
    expect(shadow.light.md).toContain('rgba');
  });
});

describe('motion tokens', () => {
  it('defines durations and easings', () => {
    expect(motion.duration.fast).toBe('150ms');
    expect(motion.duration.base).toBe('200ms');
    expect(motion.easing.out).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });
});

describe('zIndex tokens', () => {
  it('has ordered layer values', () => {
    expect(zIndex.base).toBeLessThan(zIndex.dropdown);
    expect(zIndex.dropdown).toBeLessThan(zIndex.modal);
    expect(zIndex.modal).toBeLessThan(zIndex.toast);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend/`:

```bash
npx vitest run src/design/tokens/__tests__/primitives.test.ts
```

Expected: FAIL — "Cannot find module '../primitives'".

- [ ] **Step 3: Implement `primitives.ts`**

Create `frontend/src/design/tokens/primitives.ts`:

```typescript
export const primitives = {
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  navy: {
    500: '#1A2338',
    700: '#111827',
    900: '#0B1220',
  },
  teal: {
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#22D3EE',
    600: '#0891B2',
    700: '#0E7490',
  },
  inkBlue: {
    500: '#2563EB',
    600: '#1D4ED8',
    700: '#1E40AF',
    800: '#1E3A8A',
  },
  rose: {
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
  },
  amber: {
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },
  emerald: {
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type Primitives = typeof primitives;
```

- [ ] **Step 4: Implement `spacing.ts`**

Create `frontend/src/design/tokens/spacing.ts`:

```typescript
export const spacing = {
  0: '0',
  0.5: '2px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export type SpacingToken = keyof typeof spacing;
```

- [ ] **Step 5: Implement `radius.ts`**

Create `frontend/src/design/tokens/radius.ts`:

```typescript
export const radius = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '10px',
  xl: '16px',
  pill: '9999px',
} as const;

export type RadiusToken = keyof typeof radius;
```

- [ ] **Step 6: Implement `shadow.ts`**

Create `frontend/src/design/tokens/shadow.ts`:

```typescript
export const shadow = {
  dark: {
    sm: '0 1px 2px rgba(0,0,0,0.35)',
    md: '0 4px 12px rgba(0,0,0,0.45)',
    lg: '0 12px 32px rgba(0,0,0,0.55)',
    xl: '0 24px 60px rgba(0,0,0,0.65)',
    glow: '0 0 0 1px rgba(34,211,238,0.35), 0 0 24px rgba(34,211,238,0.18)',
  },
  light: {
    sm: '0 1px 2px rgba(15,23,42,0.06)',
    md: '0 4px 12px rgba(15,23,42,0.08)',
    lg: '0 12px 32px rgba(15,23,42,0.10)',
    xl: '0 24px 60px rgba(15,23,42,0.12)',
    glow: '0 0 0 3px rgba(30,64,175,0.15)',
  },
} as const;

export type ShadowToken = keyof typeof shadow.dark;
```

- [ ] **Step 7: Implement `motion.ts`**

Create `frontend/src/design/tokens/motion.ts`:

```typescript
export const motion = {
  duration: {
    instant: '0ms',
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const;
```

- [ ] **Step 8: Implement `zIndex.ts`**

Create `frontend/src/design/tokens/zIndex.ts`:

```typescript
export const zIndex = {
  hide: -1,
  base: 0,
  raised: 10,
  sticky: 100,
  dropdown: 1000,
  overlay: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
} as const;
```

- [ ] **Step 9: Run tests to verify they pass**

Run:

```bash
npx vitest run src/design/tokens/__tests__/primitives.test.ts
```

Expected: PASS — all 6 describe blocks green.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/design/tokens/
git commit -m "feat(design): add primitive tokens (color, spacing, radius, shadow, motion, zIndex)"
```

---

## Task 3: Typography tokens

**Files:**
- Create: `frontend/src/design/tokens/typography.ts`
- Test: `frontend/src/design/tokens/__tests__/typography.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/tokens/__tests__/typography.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { typography } from '../typography';

describe('typography tokens', () => {
  it('exposes ui and mono font stacks', () => {
    expect(typography.fontFamily.ui).toContain('Inter');
    expect(typography.fontFamily.mono).toContain('JetBrains Mono');
  });

  it('exposes a type scale from caption to displayLg', () => {
    expect(typography.scale.caption.size).toBe('12px');
    expect(typography.scale.body.size).toBe('14px');
    expect(typography.scale.bodyLg.size).toBe('16px');
    expect(typography.scale.title.size).toBe('20px');
    expect(typography.scale.headline.size).toBe('28px');
    expect(typography.scale.display.size).toBe('36px');
    expect(typography.scale.displayLg.size).toBe('48px');
  });

  it('every scale entry has size, line, weight', () => {
    Object.values(typography.scale).forEach((v) => {
      expect(v.size).toMatch(/^\d+px$/);
      expect(v.line).toMatch(/^\d+px$/);
      expect(typeof v.weight).toBe('number');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/design/tokens/__tests__/typography.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `typography.ts`**

Create `frontend/src/design/tokens/typography.ts`:

```typescript
export const typography = {
  fontFamily: {
    ui: `"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`,
    mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  scale: {
    caption:   { size: '12px', line: '16px', weight: 500 },
    body:      { size: '14px', line: '20px', weight: 400 },
    bodyLg:    { size: '16px', line: '24px', weight: 400 },
    title:     { size: '20px', line: '28px', weight: 600 },
    titleLg:   { size: '24px', line: '32px', weight: 600 },
    headline:  { size: '28px', line: '36px', weight: 700 },
    display:   { size: '36px', line: '44px', weight: 700 },
    displayLg: { size: '48px', line: '56px', weight: 700 },
  },
  letterSpacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.02em',
  },
} as const;

export type TypographyScale = keyof typeof typography.scale;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/design/tokens/__tests__/typography.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/tokens/typography.ts frontend/src/design/tokens/__tests__/typography.test.ts
git commit -m "feat(design): add typography tokens (Inter Variable + JetBrains Mono)"
```

---

## Task 4: Density tokens

**Files:**
- Create: `frontend/src/design/tokens/density.ts`
- Test: `frontend/src/design/tokens/__tests__/density.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/tokens/__tests__/density.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { density, DENSITY_MODES } from '../density';

describe('density tokens', () => {
  it('exposes three modes', () => {
    expect(DENSITY_MODES).toEqual(['comfortable', 'compact', 'dense']);
  });

  it('comfortable has larger row height than dense', () => {
    expect(parseInt(density.comfortable.rowHeight)).toBeGreaterThan(
      parseInt(density.dense.rowHeight)
    );
  });

  it('each mode has rowHeight, controlHeight, paddingY', () => {
    DENSITY_MODES.forEach((mode) => {
      expect(density[mode].rowHeight).toMatch(/px$/);
      expect(density[mode].controlHeight).toMatch(/px$/);
      expect(density[mode].paddingY).toMatch(/px$/);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/design/tokens/__tests__/density.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `density.ts`**

Create `frontend/src/design/tokens/density.ts`:

```typescript
export const DENSITY_MODES = ['comfortable', 'compact', 'dense'] as const;
export type DensityMode = (typeof DENSITY_MODES)[number];

export const density: Record<DensityMode, {
  rowHeight: string;
  controlHeight: string;
  paddingY: string;
  paddingX: string;
}> = {
  comfortable: {
    rowHeight: '48px',
    controlHeight: '40px',
    paddingY: '12px',
    paddingX: '16px',
  },
  compact: {
    rowHeight: '40px',
    controlHeight: '32px',
    paddingY: '8px',
    paddingX: '12px',
  },
  dense: {
    rowHeight: '32px',
    controlHeight: '28px',
    paddingY: '4px',
    paddingX: '8px',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/design/tokens/__tests__/density.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/tokens/density.ts frontend/src/design/tokens/__tests__/density.test.ts
git commit -m "feat(design): add density tokens (comfortable/compact/dense)"
```

---

## Task 5: Semantic tokens (dark + light)

**Files:**
- Create: `frontend/src/design/tokens/semantic.ts`
- Test: `frontend/src/design/tokens/__tests__/semantic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/tokens/__tests__/semantic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { semantic, THEMES, type ThemeName } from '../semantic';

describe('semantic tokens', () => {
  it('defines both dark and light themes', () => {
    expect(THEMES).toEqual(['dark', 'light']);
  });

  it('each theme exposes bg, surface, text, border, status, accent groups', () => {
    (THEMES as readonly ThemeName[]).forEach((t) => {
      const s = semantic[t];
      expect(s.color.bg.app).toMatch(/^#|rgb/);
      expect(s.color.surface.base).toBeDefined();
      expect(s.color.text.primary).toBeDefined();
      expect(s.color.border.subtle).toBeDefined();
      expect(s.color.status.risk.high).toBeDefined();
      expect(s.color.accent.primary).toBeDefined();
    });
  });

  it('dark and light have distinct bg values', () => {
    expect(semantic.dark.color.bg.app).not.toBe(semantic.light.color.bg.app);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/design/tokens/__tests__/semantic.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `semantic.ts`**

Create `frontend/src/design/tokens/semantic.ts`:

```typescript
import { primitives as p } from './primitives';

export const THEMES = ['dark', 'light'] as const;
export type ThemeName = (typeof THEMES)[number];

type SemanticColors = {
  bg: {
    app: string;         // base page background
    elevated: string;    // cards, sheets
    raised: string;      // popovers, menus
    overlay: string;     // modal backdrop
  };
  surface: {
    base: string;
    subtle: string;
    muted: string;
    hover: string;
    selected: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    link: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    focus: string;
  };
  status: {
    success: { bg: string; fg: string; border: string };
    warning: { bg: string; fg: string; border: string };
    danger:  { bg: string; fg: string; border: string };
    info:    { bg: string; fg: string; border: string };
    risk: {
      low: string;
      medium: string;
      high: string;
      blocked: string;
    };
  };
  accent: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    onPrimary: string;
  };
};

export const semantic: Record<ThemeName, { color: SemanticColors }> = {
  dark: {
    color: {
      bg: {
        app:      p.navy[900],
        elevated: p.navy[700],
        raised:   p.slate[800],
        overlay:  'rgba(2,6,23,0.72)',
      },
      surface: {
        base:     p.navy[700],
        subtle:   'rgba(148,163,184,0.06)',
        muted:    'rgba(148,163,184,0.10)',
        hover:    'rgba(148,163,184,0.14)',
        selected: 'rgba(34,211,238,0.12)',
      },
      text: {
        primary:   p.slate[50],
        secondary: p.slate[300],
        muted:     p.slate[400],
        inverse:   p.slate[900],
        link:      p.teal[400],
      },
      border: {
        subtle:  'rgba(148,163,184,0.12)',
        default: 'rgba(148,163,184,0.20)',
        strong:  'rgba(148,163,184,0.35)',
        focus:   p.teal[400],
      },
      status: {
        success: { bg: 'rgba(16,185,129,0.14)', fg: p.emerald[400], border: 'rgba(16,185,129,0.35)' },
        warning: { bg: 'rgba(245,158,11,0.14)', fg: p.amber[400],   border: 'rgba(245,158,11,0.35)' },
        danger:  { bg: 'rgba(244,63,94,0.14)',  fg: p.rose[400],    border: 'rgba(244,63,94,0.35)' },
        info:    { bg: 'rgba(34,211,238,0.14)', fg: p.teal[400],    border: 'rgba(34,211,238,0.35)' },
        risk: {
          low:     p.emerald[400],
          medium:  p.amber[400],
          high:    p.rose[400],
          blocked: p.slate[400],
        },
      },
      accent: {
        primary:       p.teal[400],
        primaryHover:  p.teal[300],
        primaryActive: p.teal[600],
        onPrimary:     p.navy[900],
      },
    },
  },
  light: {
    color: {
      bg: {
        app:      p.white,
        elevated: p.white,
        raised:   p.white,
        overlay:  'rgba(15,23,42,0.40)',
      },
      surface: {
        base:     p.slate[50],
        subtle:   p.slate[100],
        muted:    p.slate[200],
        hover:    p.slate[100],
        selected: 'rgba(30,64,175,0.08)',
      },
      text: {
        primary:   p.slate[900],
        secondary: p.slate[700],
        muted:     p.slate[500],
        inverse:   p.white,
        link:      p.inkBlue[700],
      },
      border: {
        subtle:  p.slate[200],
        default: p.slate[300],
        strong:  p.slate[400],
        focus:   p.inkBlue[600],
      },
      status: {
        success: { bg: '#ECFDF5', fg: p.emerald[600], border: '#A7F3D0' },
        warning: { bg: '#FFFBEB', fg: p.amber[600],   border: '#FDE68A' },
        danger:  { bg: '#FEF2F2', fg: p.rose[600],    border: '#FECACA' },
        info:    { bg: '#EFF6FF', fg: p.inkBlue[700], border: '#BFDBFE' },
        risk: {
          low:     p.emerald[600],
          medium:  p.amber[600],
          high:    p.rose[600],
          blocked: p.slate[500],
        },
      },
      accent: {
        primary:       p.inkBlue[700],
        primaryHover:  p.inkBlue[600],
        primaryActive: p.inkBlue[800],
        onPrimary:     p.white,
      },
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/design/tokens/__tests__/semantic.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/tokens/semantic.ts frontend/src/design/tokens/__tests__/semantic.test.ts
git commit -m "feat(design): add semantic tokens for dark and light themes"
```

---

## Task 6: Tokens barrel + index

**Files:**
- Create: `frontend/src/design/tokens/index.ts`

- [ ] **Step 1: Create barrel file**

Create `frontend/src/design/tokens/index.ts`:

```typescript
export { primitives } from './primitives';
export { semantic, THEMES, type ThemeName } from './semantic';
export { spacing, type SpacingToken } from './spacing';
export { typography, type TypographyScale } from './typography';
export { radius, type RadiusToken } from './radius';
export { shadow, type ShadowToken } from './shadow';
export { motion } from './motion';
export { zIndex } from './zIndex';
export { density, DENSITY_MODES, type DensityMode } from './density';
```

- [ ] **Step 2: Verify it compiles**

Run:

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: no errors (or same baseline errors as before, none added).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/design/tokens/index.ts
git commit -m "feat(design): add tokens barrel export"
```

---

## Task 7: CSS variable serializer

**Files:**
- Create: `frontend/src/design/theme/cssVars.ts`
- Test: `frontend/src/design/theme/__tests__/cssVars.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/theme/__tests__/cssVars.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toCssVarName, themeToCssVars, staticCssVars } from '../cssVars';

describe('toCssVarName', () => {
  it('converts dot paths to kebab CSS var names', () => {
    expect(toCssVarName(['color', 'bg', 'app'])).toBe('--color-bg-app');
    expect(toCssVarName(['color', 'status', 'risk', 'high'])).toBe('--color-status-risk-high');
  });
});

describe('themeToCssVars', () => {
  it('produces a flat map of CSS var → value for dark theme', () => {
    const vars = themeToCssVars('dark');
    expect(vars['--color-bg-app']).toBeDefined();
    expect(vars['--color-text-primary']).toBeDefined();
    expect(vars['--color-status-risk-high']).toBeDefined();
  });

  it('dark and light produce different bg values', () => {
    const dark = themeToCssVars('dark');
    const light = themeToCssVars('light');
    expect(dark['--color-bg-app']).not.toBe(light['--color-bg-app']);
  });
});

describe('staticCssVars', () => {
  it('emits spacing, radius, motion, zIndex vars', () => {
    const vars = staticCssVars();
    expect(vars['--space-4']).toBe('16px');
    expect(vars['--radius-md']).toBe('6px');
    expect(vars['--motion-duration-base']).toBe('200ms');
    expect(vars['--z-modal']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/design/theme/__tests__/cssVars.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cssVars.ts`**

Create `frontend/src/design/theme/cssVars.ts`:

```typescript
import { semantic, type ThemeName } from '../tokens/semantic';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/radius';
import { motion } from '../tokens/motion';
import { zIndex } from '../tokens/zIndex';
import { shadow } from '../tokens/shadow';

export function toCssVarName(path: readonly string[]): string {
  return `--${path.join('-')}`;
}

function flatten(
  obj: Record<string, unknown>,
  prefix: readonly string[] = []
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = [...prefix, k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, path));
    } else {
      out[toCssVarName(path)] = String(v);
    }
  }
  return out;
}

export function themeToCssVars(theme: ThemeName): Record<string, string> {
  const themeShadow = shadow[theme];
  const vars = flatten(semantic[theme]);
  for (const [k, v] of Object.entries(themeShadow)) {
    vars[`--shadow-${k}`] = v;
  }
  return vars;
}

export function staticCssVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(spacing)) {
    out[`--space-${k}`] = v;
  }
  for (const [k, v] of Object.entries(radius)) {
    out[`--radius-${k}`] = v;
  }
  for (const [k, v] of Object.entries(motion.duration)) {
    out[`--motion-duration-${k}`] = v;
  }
  for (const [k, v] of Object.entries(motion.easing)) {
    out[`--motion-easing-${k}`] = v;
  }
  for (const [k, v] of Object.entries(zIndex)) {
    out[`--z-${k}`] = String(v);
  }
  return out;
}

export function cssVarString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/design/theme/__tests__/cssVars.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/theme/cssVars.ts frontend/src/design/theme/__tests__/cssVars.test.ts
git commit -m "feat(design): add CSS variable serializer for token → :root vars"
```

---

## Task 8: global.css with :root variables

**Files:**
- Create: `frontend/src/design/global.css`

- [ ] **Step 1: Create `global.css`**

Create `frontend/src/design/global.css`:

```css
@import '@fontsource-variable/inter';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';

/*
  Design system root.
  CSS variables for both themes are injected by ThemeProvider at runtime
  (not hard-coded here) so primitives.ts/semantic.ts remain the single source of truth.
  This file contains only: reset, base typography, and shared non-themed rules.
*/

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

html, body, #root {
  height: 100%;
}

body {
  margin: 0;
  font-family: "Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px;
  line-height: 20px;
  color: var(--color-text-primary);
  background: var(--color-bg-app);
  transition: background-color var(--motion-duration-base) var(--motion-easing-out),
              color var(--motion-duration-base) var(--motion-easing-out);
}

code, kbd, pre, samp {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* Focus ring — visible only on keyboard navigation */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/design/global.css
git commit -m "feat(design): add global.css with reset, base typography, focus ring, reduced-motion"
```

---

## Task 9: AntD theme mapping

**Files:**
- Create: `frontend/src/design/theme/antdTheme.ts`
- Test: `frontend/src/design/theme/__tests__/antdTheme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/theme/__tests__/antdTheme.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getAntdTheme } from '../antdTheme';
import { theme as antdAlgo } from 'antd';

describe('getAntdTheme', () => {
  it('returns dark algorithm for dark theme', () => {
    const t = getAntdTheme('dark');
    expect(t.algorithm).toBe(antdAlgo.darkAlgorithm);
  });

  it('returns default algorithm for light theme', () => {
    const t = getAntdTheme('light');
    expect(t.algorithm).toBe(antdAlgo.defaultAlgorithm);
  });

  it('maps semantic tokens into AntD token slots', () => {
    const t = getAntdTheme('dark');
    expect(t.token?.colorPrimary).toBeDefined();
    expect(t.token?.colorBgBase).toBeDefined();
    expect(t.token?.colorTextBase).toBeDefined();
    expect(t.token?.borderRadius).toBe(6);
    expect(t.token?.fontFamily).toContain('Inter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/design/theme/__tests__/antdTheme.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `antdTheme.ts`**

Create `frontend/src/design/theme/antdTheme.ts`:

```typescript
import { theme as antd, type ThemeConfig } from 'antd';
import { semantic, type ThemeName } from '../tokens/semantic';
import { typography } from '../tokens/typography';
import { radius } from '../tokens/radius';

export function getAntdTheme(mode: ThemeName): ThemeConfig {
  const s = semantic[mode].color;
  const algorithm = mode === 'dark' ? antd.darkAlgorithm : antd.defaultAlgorithm;

  return {
    algorithm,
    token: {
      colorPrimary:     s.accent.primary,
      colorInfo:        s.status.info.fg,
      colorSuccess:     s.status.success.fg,
      colorWarning:     s.status.warning.fg,
      colorError:       s.status.danger.fg,
      colorBgBase:      s.bg.app,
      colorTextBase:    s.text.primary,
      colorBorder:      s.border.default,
      colorBorderSecondary: s.border.subtle,
      borderRadius:     parseInt(radius.md),
      borderRadiusLG:   parseInt(radius.lg),
      borderRadiusSM:   parseInt(radius.sm),
      fontFamily:       typography.fontFamily.ui,
      fontFamilyCode:   typography.fontFamily.mono,
      fontSize:         14,
      fontSizeLG:       16,
      fontSizeSM:       12,
    },
    components: {
      Card: {
        borderRadiusLG: parseInt(radius.lg),
        colorBgContainer: s.bg.elevated,
      },
      Button: {
        borderRadius: parseInt(radius.md),
        controlHeight: 36,
        fontWeight: 500,
      },
      Table: {
        colorBgContainer: s.bg.elevated,
        headerBg: s.surface.subtle,
        rowHoverBg: s.surface.hover,
        rowSelectedBg: s.surface.selected,
        borderColor: s.border.subtle,
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: s.surface.hover,
        itemSelectedBg: s.surface.selected,
        itemSelectedColor: s.accent.primary,
      },
      Tag: {
        borderRadiusSM: parseInt(radius.sm),
      },
      Tooltip: {
        colorBgSpotlight: s.bg.raised,
      },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/design/theme/__tests__/antdTheme.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/design/theme/antdTheme.ts frontend/src/design/theme/__tests__/antdTheme.test.ts
git commit -m "feat(design): map semantic tokens to AntD ConfigProvider theme"
```

---

## Task 10: ThemeProvider + useTheme hook

**Files:**
- Create: `frontend/src/design/theme/ThemeProvider.tsx`
- Create: `frontend/src/design/theme/useTheme.ts`
- Test: `frontend/src/design/theme/__tests__/ThemeProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/design/theme/__tests__/ThemeProvider.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';
import { useTheme } from '../useTheme';

function Probe() {
  const { theme, setTheme, density, setDensity } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="density">{density}</span>
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>toggle</button>
      <button onClick={() => setDensity('compact')}>compact</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    localStorage.clear();
  });

  it('defaults to dark theme and comfortable density', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('density').textContent).toBe('comfortable');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.density).toBe('comfortable');
  });

  it('setTheme flips the data-theme attribute on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('setDensity flips the data-density attribute on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByText('compact').click());
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('persists theme and density in localStorage', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    act(() => screen.getByText('compact').click());
    expect(localStorage.getItem('ui.theme')).toBe('light');
    expect(localStorage.getItem('ui.density')).toBe('compact');
  });

  it('injects CSS variables for the active theme into <head>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    const style = document.getElementById('design-system-vars');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('--color-bg-app');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/design/theme/__tests__/ThemeProvider.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useTheme.ts`**

Create `frontend/src/design/theme/useTheme.ts`:

```typescript
import { createContext, useContext } from 'react';
import type { ThemeName } from '../tokens/semantic';
import type { DensityMode } from '../tokens/density';

export type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  density: DensityMode;
  setDensity: (d: DensityMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
```

- [ ] **Step 4: Implement `ThemeProvider.tsx`**

Create `frontend/src/design/theme/ThemeProvider.tsx`:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { ThemeContext, type ThemeContextValue } from './useTheme';
import { getAntdTheme } from './antdTheme';
import { themeToCssVars, staticCssVars, cssVarString } from './cssVars';
import { THEMES, type ThemeName } from '../tokens/semantic';
import { DENSITY_MODES, type DensityMode } from '../tokens/density';

const THEME_KEY = 'ui.theme';
const DENSITY_KEY = 'ui.density';
const STYLE_ID = 'design-system-vars';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
}

function injectCssVars() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const statics = staticCssVars();
  const dark = themeToCssVars('dark');
  const light = themeToCssVars('light');
  el.textContent = `
:root {
  ${cssVarString(statics)}
}
:root[data-theme="dark"] {
  ${cssVarString(dark)}
}
:root[data-theme="light"] {
  ${cssVarString(light)}
}
`.trim();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    readStored<ThemeName>(THEME_KEY, THEMES, 'dark')
  );
  const [density, setDensityState] = useState<DensityMode>(() =>
    readStored<DensityMode>(DENSITY_KEY, DENSITY_MODES, 'comfortable')
  );

  // Inject CSS vars once on mount.
  useEffect(() => { injectCssVars(); }, []);

  // Apply data-theme + data-density to <html>.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      density,
      setDensity: setDensityState,
    }),
    [theme, density]
  );

  const antdTheme = useMemo(() => getAntdTheme(theme), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npx vitest run src/design/theme/__tests__/ThemeProvider.test.tsx
```

Expected: PASS — all 5 assertions.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/design/theme/
git commit -m "feat(design): ThemeProvider with data-theme flip, CSS var injection, persistence"
```

---

## Task 11: Theme barrel

**Files:**
- Create: `frontend/src/design/theme/index.ts`

- [ ] **Step 1: Create barrel**

Create `frontend/src/design/theme/index.ts`:

```typescript
export { ThemeProvider } from './ThemeProvider';
export { useTheme, type ThemeContextValue } from './useTheme';
export { getAntdTheme } from './antdTheme';
export { themeToCssVars, staticCssVars } from './cssVars';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/design/theme/index.ts
git commit -m "feat(design): theme barrel export"
```

---

## Task 12: Wire ThemeProvider into main.tsx

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Replace main.tsx**

Replace the contents of `frontend/src/main.tsx` with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeProvider } from './design/theme';
import './design/global.css';
import './styles/utilities.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Start dev server and verify no visual regression**

Run from `frontend/`:

```bash
npm run dev
```

Open http://localhost:3000. Expected:
- App loads (may look slightly different because dark theme is now default; that's OK).
- No console errors about missing tokens or providers.
- DevTools → Elements → `<html>` has `data-theme="dark"` and `data-density="comfortable"` attributes.
- DevTools → Elements → `<head>` has a `<style id="design-system-vars">` block with CSS variables.

Stop the dev server (Ctrl+C) before continuing.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "feat(design): wire ThemeProvider into app root"
```

---

## Task 13: Design system sandbox route

**Files:**
- Create: `frontend/src/design/sandbox/DesignSystemSandbox.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the sandbox page**

Create `frontend/src/design/sandbox/DesignSystemSandbox.tsx`:

```tsx
import { useTheme } from '../theme';
import { DENSITY_MODES } from '../tokens/density';
import { THEMES } from '../tokens/semantic';

export function DesignSystemSandbox() {
  const { theme, setTheme, density, setDensity } = useTheme();

  const swatches = [
    'color-bg-app', 'color-bg-elevated', 'color-surface-base',
    'color-text-primary', 'color-text-secondary', 'color-text-muted',
    'color-border-default', 'color-accent-primary',
    'color-status-risk-low', 'color-status-risk-medium', 'color-status-risk-high',
  ];

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', background: 'var(--color-bg-app)', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Design System Sandbox
      </h1>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Theme</h2>
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            style={{
              marginRight: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid var(--color-border-default)`,
              background: theme === t ? 'var(--color-accent-primary)' : 'var(--color-bg-elevated)',
              color: theme === t ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Density</h2>
        {DENSITY_MODES.map((d) => (
          <button
            key={d}
            onClick={() => setDensity(d)}
            aria-pressed={density === d}
            style={{
              marginRight: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid var(--color-border-default)`,
              background: density === d ? 'var(--color-accent-primary)' : 'var(--color-bg-elevated)',
              color: density === d ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {d}
          </button>
        ))}
      </section>

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Semantic color swatches</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          {swatches.map((name) => (
            <div
              key={name}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                background: 'var(--color-bg-elevated)',
              }}
            >
              <div
                aria-hidden
                style={{
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  background: `var(--${name})`,
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 'var(--space-2)',
                }}
              />
              <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                --{name}
              </code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

> Note: inline `style=` is used here *only* because the lint rule banning it is scheduled for Phase 1. This file will be refactored when primitives land. The sandbox is dev-only and not shipped in production builds.

- [ ] **Step 2: Add a dev-only route to App.tsx**

Read the current App.tsx to find the existing `<Routes>` block:

```bash
grep -n "Routes" frontend/src/App.tsx
```

Open `frontend/src/App.tsx` and add these two changes:

1. Import the sandbox lazily at the top of the file (alongside other imports):

```tsx
import { lazy, Suspense } from 'react';
const DesignSystemSandbox = lazy(() =>
  import('./design/sandbox/DesignSystemSandbox').then((m) => ({ default: m.DesignSystemSandbox }))
);
```

2. Inside the existing `<Routes>` block, add before any catch-all route:

```tsx
{import.meta.env.DEV && (
  <Route
    path="/design-sandbox"
    element={
      <Suspense fallback={<div>Loading…</div>}>
        <DesignSystemSandbox />
      </Suspense>
    }
  />
)}
```

- [ ] **Step 3: Verify the sandbox renders**

Run:

```bash
npm run dev
```

Open http://localhost:3000/design-sandbox. Expected:
- Dark page with "Design System Sandbox" heading.
- Theme buttons switch between dark and light; page colors change instantly with no flash.
- Density buttons update `<html data-density>`.
- Swatches render with correct colors per theme.
- No console errors.

Stop the dev server.

- [ ] **Step 4: Run full test suite to ensure nothing regressed**

Run:

```bash
npm test
```

Expected: all existing tests pass; new Phase 0 tests pass.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 6: Run lint**

Run:

```bash
npm run lint
```

Expected: no new lint errors. (Existing warnings may remain — they'll be cleaned in Phase 1.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/design/sandbox/ frontend/src/App.tsx
git commit -m "feat(design): add /design-sandbox dev route to preview tokens and theme switching"
```

---

## Phase 0 Completion Checklist

- [ ] All 13 tasks committed
- [ ] `npm test` passes
- [ ] `npm run lint` passes (no new errors)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run dev` → `/design-sandbox` shows theme + density controls working
- [ ] Existing pages still render (may have slight visual changes from new AntD mapping — expected, not a regression)
- [ ] Final commit: tag `design-phase-0` for reference

```bash
git tag design-phase-0
```

---

## Follow-up Plans (not in this document)

Each of these deserves its own plan file when Phase 0 is merged:

- **Phase 1 — Enforcement + Primitives** (`2026-04-XX-phase-1-primitives.md`): ESLint rule banning inline `style=`, stylelint config, `Stack`/`Inline`/`Box`/`Text` primitives, migrate App Shell as reference.
- **Phase 2 — Core Components** (`2026-04-XX-phase-2-components.md`): StatCard, StatusChip, DataTable, PageHeader, SectionCard, Skeleton, EmptyState, Timeline, RiskMeter, UserAvatar.
- **Phase 3 — Flagship: Home Dashboard** (`2026-04-XX-phase-3-home-dashboard.md`): Rebuild Home using tokens + components; introduce `DashboardConfig` type.
- **Phase 4 — Remaining Pages** (`2026-04-XX-phase-4-pages.md`): Pipeline, Work Items, TR Search, Reports, Settings, Admin, Coupa + Commercial dashboards.
- **Phase 5 — Performance & Polish** (`2026-04-XX-phase-5-polish.md`): Code splitting, chart theming, motion polish, icon migration.
- **Phase 6 — Accessibility & QA** (`2026-04-XX-phase-6-a11y.md`): axe in CI, screen reader pass, keyboard audit, WCAG AA sign-off.

Each follow-up plan should assume the previous phase is merged and its `design-phase-N` tag exists.
