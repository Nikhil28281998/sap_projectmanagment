export const typography = {
  fontFamily: {
    ui: `"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`,
    mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
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
  letterSpacing: { tight: '-0.01em', normal: '0', wide: '0.02em' },
} as const;

export type TypographyScale = keyof typeof typography.scale;
