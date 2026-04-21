import { type CSSProperties, useEffect } from 'react';

export type SkeletonPanelProps = {
  variant: 'card' | 'list' | 'table';
  rows?: number;
  className?: string;
  'data-testid'?: string;
};

const STYLE_ID = 'ds-skeleton-pulse-keyframes';

function ensureKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@keyframes ds-skeleton-pulse { 0%, 100% { opacity: 0.6 } 50% { opacity: 1 } }`;
  document.head.appendChild(style);
}

function bar(height: number, width: string | number = '100%', key?: string | number): JSX.Element {
  const s: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-muted)',
    animation: 'ds-skeleton-pulse 1.4s var(--motion-easing-out) infinite',
  };
  return <div key={key} data-role="skeleton-bar" style={s} />;
}

function useKeyframes(): void {
  useEffect(() => {
    ensureKeyframes();
  }, []);
}

export function SkeletonPanel(props: SkeletonPanelProps) {
  const { variant, rows = 5, className } = props;
  const testId = props['data-testid'];
  useKeyframes();

  const rootStyle: CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  };

  if (variant === 'card') {
    return (
      <div
        className={className}
        data-testid={testId}
        data-variant="card"
        style={rootStyle}
      >
        {bar(16, '60%', 'label')}
        {bar(36, '40%', 'value')}
        {bar(12, '80%', 'caption')}
      </div>
    );
  }

  if (variant === 'list') {
    const items = Array.from({ length: rows }, (_, i) => bar(20, '100%', i));
    return (
      <div
        className={className}
        data-testid={testId}
        data-variant="list"
        style={{ ...rootStyle, gap: 'var(--space-2)' }}
      >
        {items}
      </div>
    );
  }

  // table
  const columns = 4;
  const renderRow = (cells: number, isHeader: boolean, key: number | string) => (
    <div
      key={key}
      data-role={isHeader ? 'skeleton-header-row' : 'skeleton-row'}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cells}, 1fr)`,
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      {Array.from({ length: cells }, (_, i) =>
        bar(isHeader ? 14 : 16, '80%', `${key}-${i}`),
      )}
    </div>
  );

  return (
    <div
      className={className}
      data-testid={testId}
      data-variant="table"
      style={rootStyle}
    >
      {renderRow(columns, true, 'header')}
      {Array.from({ length: rows }, (_, i) => renderRow(columns, false, i))}
    </div>
  );
}
