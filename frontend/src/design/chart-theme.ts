/**
 * Chart theme helpers — read CSS variables so AntD Charts match the active
 * design-system theme. Call these inside the render so they evaluate per-render.
 */

function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined') return fallback;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

export const chartColors = {
  /** grid / axis line color, semantic `--color-border-subtle` */
  grid: () => cssVar('--color-border-subtle', '#e5e7eb'),
  /** text color for axis labels */
  text: () => cssVar('--color-text-secondary', '#6b7280'),
  /** muted text for axis titles */
  muted: () => cssVar('--color-text-muted', '#9ca3af'),
  /** status colors for RAG chart segments */
  riskLow:    () => cssVar('--color-status-risk-low',    '#10b981'),
  riskMedium: () => cssVar('--color-status-risk-medium', '#f59e0b'),
  riskHigh:   () => cssVar('--color-status-risk-high',   '#ef4444'),
  /** primary accent */
  accent: () => cssVar('--color-accent-primary', '#4f46e5'),
};

/**
 * Ready-to-spread axis config for AntD Charts (both x and y axes).
 * Uses dashed grid and token-matching colors.
 */
export function tokenAxisConfig() {
  return {
    x: {
      title: false,
      line: null,
      tick: null,
      label: { style: { fill: chartColors.text() } },
    },
    y: {
      title: false,
      gridStroke: chartColors.grid(),
      gridLineDash: [3, 3] as [number, number],
      label: { style: { fill: chartColors.text() } },
    },
  };
}

/** Palette for status-mapped series (GREEN / AMBER / RED). */
export function ragPalette() {
  return [chartColors.riskLow(), chartColors.riskMedium(), chartColors.riskHigh()];
}
