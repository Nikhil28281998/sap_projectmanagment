import { type CSSProperties } from 'react';

export type StatusChipStatus =
  | 'on-track'
  | 'at-risk'
  | 'critical'
  | 'blocked'
  | 'done'
  | 'pending'
  | 'in-progress';

export type StatusChipProps = {
  status: StatusChipStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
  'data-testid'?: string;
};

type Palette = { bg: string; fg: string; border: string; dot: string };

const palette: Record<StatusChipStatus, Palette> = {
  'on-track': {
    bg: 'var(--color-status-success-bg)',
    fg: 'var(--color-status-success-fg)',
    border: 'var(--color-status-success-border)',
    dot: 'var(--color-status-risk-low)',
  },
  done: {
    bg: 'var(--color-status-success-bg)',
    fg: 'var(--color-status-success-fg)',
    border: 'var(--color-status-success-border)',
    dot: 'var(--color-status-risk-low)',
  },
  'at-risk': {
    bg: 'var(--color-status-warning-bg)',
    fg: 'var(--color-status-warning-fg)',
    border: 'var(--color-status-warning-border)',
    dot: 'var(--color-status-risk-medium)',
  },
  pending: {
    bg: 'var(--color-status-warning-bg)',
    fg: 'var(--color-status-warning-fg)',
    border: 'var(--color-status-warning-border)',
    dot: 'var(--color-status-risk-medium)',
  },
  critical: {
    bg: 'var(--color-status-danger-bg)',
    fg: 'var(--color-status-danger-fg)',
    border: 'var(--color-status-danger-border)',
    dot: 'var(--color-status-risk-high)',
  },
  blocked: {
    bg: 'var(--color-surface-muted)',
    fg: 'var(--color-text-muted)',
    border: 'var(--color-border-subtle)',
    dot: 'var(--color-status-risk-blocked)',
  },
  'in-progress': {
    bg: 'var(--color-status-info-bg)',
    fg: 'var(--color-status-info-fg)',
    border: 'var(--color-status-info-border)',
    dot: 'var(--color-status-info-fg)',
  },
};

const defaultLabels: Record<StatusChipStatus, string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  critical: 'Critical',
  blocked: 'Blocked',
  done: 'Done',
  pending: 'Pending',
  'in-progress': 'In Progress',
};

export function StatusChip(props: StatusChipProps) {
  const { status, label, size = 'md', className } = props;
  const testId = props['data-testid'];
  const colors = palette[status];
  const text = label ?? defaultLabels[status];

  const padding = size === 'sm' ? '2px 8px' : '4px 10px';

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    padding,
    borderRadius: 'var(--radius-pill)',
    background: colors.bg,
    color: colors.fg,
    border: `1px solid ${colors.border}`,
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: colors.dot,
    display: 'inline-block',
  };

  return (
    <span
      className={className}
      data-testid={testId}
      data-status={status}
      data-size={size}
      style={style}
    >
      <span aria-hidden="true" data-role="dot" style={dotStyle} />
      {text}
    </span>
  );
}
