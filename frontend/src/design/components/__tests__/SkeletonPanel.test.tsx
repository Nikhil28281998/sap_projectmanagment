import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonPanel } from '../SkeletonPanel';

describe('SkeletonPanel', () => {
  it('variant="card" renders at least one skeleton bar', () => {
    const { container } = render(<SkeletonPanel variant="card" />);
    const bars = container.querySelectorAll('[data-role="skeleton-bar"]');
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it('variant="list" with rows=3 renders 3 rows', () => {
    const { container } = render(<SkeletonPanel variant="list" rows={3} />);
    const bars = container.querySelectorAll('[data-role="skeleton-bar"]');
    expect(bars.length).toBe(3);
  });

  it('variant="table" with rows=4 renders 4 data rows + 1 header row', () => {
    const { container } = render(<SkeletonPanel variant="table" rows={4} />);
    const headerRows = container.querySelectorAll('[data-role="skeleton-header-row"]');
    const dataRows = container.querySelectorAll('[data-role="skeleton-row"]');
    expect(headerRows.length).toBe(1);
    expect(dataRows.length).toBe(4);
  });

  it('applies data-variant attribute', () => {
    const { getByTestId } = render(
      <SkeletonPanel variant="list" data-testid="s" />,
    );
    expect(getByTestId('s').getAttribute('data-variant')).toBe('list');
  });

  it('passes className', () => {
    const { getByTestId } = render(
      <SkeletonPanel variant="card" className="c" data-testid="t" />,
    );
    expect(getByTestId('t').className).toBe('c');
  });
});
