import { type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export type ChartFrameProps = {
  loading?: boolean;
  /** When provided and empty, renders EmptyState instead of children. */
  empty?: boolean;
  summary: string;
  height?: number;
  children: ReactNode;
};

/**
 * Accessibility + loading + empty-state wrapper for chart components.
 * - Renders a shimmer skeleton while `loading` is true.
 * - Renders an EmptyState when `empty` is true.
 * - Exposes a `role="img"` + `aria-label` so screen readers get a
 *   plain-English summary of the chart instead of the canvas.
 */
export function ChartFrame({ loading, empty, summary, height = 240, children }: ChartFrameProps) {
  if (loading) {
    return (
      <div
        className="chart-skeleton"
        role="img"
        aria-label={`Loading: ${summary}`}
        aria-busy="true"
        style={{ height }}
      />
    );
  }
  if (empty) {
    return (
      <div className="chart-empty-placeholder" role="img" aria-label={`No data: ${summary}`}>
        <EmptyState title="No data" />
      </div>
    );
  }
  return (
    <div role="img" aria-label={summary} style={{ width: '100%' }}>
      {children}
    </div>
  );
}
