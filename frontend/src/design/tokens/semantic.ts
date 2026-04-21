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
        risk: { low: p.emerald[400], medium: p.amber[400], high: p.rose[400], blocked: p.slate[400] },
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
        risk: { low: p.emerald[600], medium: p.amber[600], high: p.rose[600], blocked: p.slate[500] },
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
