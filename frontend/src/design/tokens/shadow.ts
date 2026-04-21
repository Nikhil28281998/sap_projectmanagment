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
