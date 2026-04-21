export const radius = {
  none: '0', sm: '4px', md: '6px', lg: '10px', xl: '16px', pill: '9999px',
} as const;
export type RadiusToken = keyof typeof radius;
