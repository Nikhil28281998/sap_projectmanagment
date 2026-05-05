export const DENSITY_MODES = ['comfortable', 'compact', 'dense'] as const;
export type DensityMode = (typeof DENSITY_MODES)[number];

export const density: Record<DensityMode, {
  rowHeight: string;
  controlHeight: string;
  paddingY: string;
  paddingX: string;
}> = {
  comfortable: { rowHeight: '48px', controlHeight: '40px', paddingY: '12px', paddingX: '16px' },
  compact:     { rowHeight: '40px', controlHeight: '32px', paddingY: '8px',  paddingX: '12px' },
  dense:       { rowHeight: '32px', controlHeight: '28px', paddingY: '4px',  paddingX: '8px' },
};
