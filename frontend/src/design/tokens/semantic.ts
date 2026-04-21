import { primitives as p } from './primitives';

export const THEMES = ['dark', 'light'] as const;
export type ThemeName = (typeof THEMES)[number];

type SemanticColors = {
  bg: { app: string; elevated: string; raised: string; overlay: string };
  surface: { base: string; subtle: string; muted: string; hover: string; selected: string };
  text: { primary: string; secondary: string; muted: string; inverse: string; link: string };
  border: { subtle: string; default: string; strong: string; focus: string };
  status: {
    success: { bg: string; fg: string; border: string };
    warning: { bg: string; fg: string; border: string };
    danger:  { bg: string; fg: string; border: string };
    info:    { bg: string; fg: string; border: string };
    risk: { low: string; medium: string; high: string; blocked: string };
  };
  accent: { primary: string; primaryHover: string; primaryActive: string; onPrimary: string };
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
        selected: 'rgba(129,140,248,0.14)',
      },
      text: {
        primary:   p.slate[50],
        secondary: p.slate[300],
        muted:     p.slate[400],
        inverse:   p.slate[900],
        link:      p.indigo[300],
      },
      border: {
        subtle:  'rgba(148,163,184,0.12)',
        default: 'rgba(148,163,184,0.20)',
        strong:  'rgba(148,163,184,0.35)',
        focus:   p.indigo[400],
      },
      status: {
        success: { bg: 'rgba(16,185,129,0.14)', fg: p.emerald[400], border: 'rgba(16,185,129,0.35)' },
        warning: { bg: 'rgba(245,158,11,0.14)', fg: p.amber[400],   border: 'rgba(245,158,11,0.35)' },
        danger:  { bg: 'rgba(244,63,94,0.14)',  fg: p.rose[400],    border: 'rgba(244,63,94,0.35)' },
        info:    { bg: 'rgba(129,140,248,0.14)', fg: p.indigo[300], border: 'rgba(129,140,248,0.35)' },
        risk: { low: p.emerald[400], medium: p.amber[400], high: p.rose[400], blocked: p.slate[400] },
      },
      accent: {
        primary:       p.indigo[400],
        primaryHover:  p.indigo[300],
        primaryActive: p.indigo[500],
        onPrimary:     p.slate[950],
      },
    },
  },
  light: {
    color: {
      bg: {
        app:      '#FBFBFC',       // subtle off-white page (Linear/Stripe/Vercel)
        elevated: p.white,         // pure white cards stand out against page
        raised:   p.white,
        overlay:  'rgba(15,23,42,0.40)',
      },
      surface: {
        base:     p.slate[50],
        subtle:   p.slate[100],
        muted:    p.slate[200],
        hover:    p.slate[100],
        selected: 'rgba(99,102,241,0.08)',
      },
      text: {
        primary:   p.slate[900],
        secondary: p.slate[700],
        muted:     p.slate[500],
        inverse:   p.white,
        link:      p.indigo[600],
      },
      border: {
        subtle:  p.slate[200],
        default: p.slate[300],
        strong:  p.slate[400],
        focus:   p.indigo[500],
      },
      status: {
        success: { bg: '#ECFDF5', fg: p.emerald[600], border: '#A7F3D0' },
        warning: { bg: '#FFFBEB', fg: p.amber[600],   border: '#FDE68A' },
        danger:  { bg: '#FEF2F2', fg: p.rose[600],    border: '#FECACA' },
        info:    { bg: '#EEF2FF', fg: p.indigo[600],  border: '#C7D2FE' },
        risk: { low: p.emerald[600], medium: p.amber[600], high: p.rose[600], blocked: p.slate[500] },
      },
      accent: {
        primary:       p.indigo[600],
        primaryHover:  p.indigo[500],
        primaryActive: p.indigo[700],
        onPrimary:     p.white,
      },
    },
  },
};
