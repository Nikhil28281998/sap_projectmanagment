import { type CSSProperties } from 'react';

export type RiskMeterProps = {
  score: number;
  clamp?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'data-testid'?: string;
};

const heights = { sm: 6, md: 8, lg: 12 } as const;

function fillColor(score: number): string {
  if (score <= 33) return 'var(--color-status-risk-low)';
  if (score <= 66) return 'var(--color-status-risk-medium)';
  return 'var(--color-status-risk-high)';
}

export function RiskMeter(props: RiskMeterProps) {
  const { score, clamp = true, label, size = 'md', className } = props;
  const testId = props['data-testid'];

  const normalized = clamp ? Math.max(0, Math.min(100, score)) : score;
  const color = fillColor(normalized);
  const h = heights[size];

  const trackStyle: CSSProperties = {
    width: '100%',
    height: h,
    borderRadius: 'var(--radius-pill)',
    background: 'var(--color-surface-subtle)',
    overflow: 'hidden',
  };

  const fillStyle: CSSProperties = {
    width: `${normalized}%`,
    height: '100%',
    background: color,
    borderRadius: 'var(--radius-pill)',
    transition: 'width var(--motion-duration-base) var(--motion-easing-out)',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-1)',
  };

  return (
    <div
      className={className}
      data-testid={testId}
      data-role="risk-meter"
      role="meter"
      aria-label={label ?? 'Risk score'}
      aria-valuenow={normalized}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ width: '100%' }}
    >
      <div style={headerStyle}>
        {label !== undefined && (
          <span
            style={{
              fontSize: '12px',
              lineHeight: '16px',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
            }}
          >
            {label}
          </span>
        )}
        <span
          data-role="risk-value"
          style={{
            fontSize: '14px',
            lineHeight: '20px',
            fontWeight: 700,
            color,
            marginLeft: label !== undefined ? 'auto' : undefined,
          }}
        >
          {normalized}
        </span>
      </div>
      <div style={trackStyle} data-role="risk-track">
        <div style={fillStyle} data-role="risk-fill" />
      </div>
    </div>
  );
}
