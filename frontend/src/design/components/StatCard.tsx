import { type CSSProperties, type ReactNode, type KeyboardEvent } from 'react';
import { Stack } from '../primitives/Stack';
import { Inline } from '../primitives/Inline';
import { Text } from '../primitives/Text';

export type StatCardTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type StatCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  caption?: string;
  delta?: { direction: 'up' | 'down' | 'neutral'; text: string };
  tone?: StatCardTone;
  icon?: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
  'data-testid'?: string;
};

const toneAccent: Record<StatCardTone, string> = {
  neutral: 'var(--color-border-default)',
  success: 'var(--color-status-success-fg)',
  warning: 'var(--color-status-warning-fg)',
  danger: 'var(--color-status-danger-fg)',
  info: 'var(--color-status-info-fg)',
};

const deltaColor = {
  up: 'var(--color-status-risk-low)',
  down: 'var(--color-status-risk-high)',
  neutral: 'var(--color-text-muted)',
} as const;

const deltaArrow = { up: '\u2191', down: '\u2193', neutral: '\u2192' } as const;

export function StatCard(props: StatCardProps) {
  const {
    label,
    value,
    unit,
    caption,
    delta,
    tone = 'neutral',
    icon,
    onClick,
    loading,
    className,
  } = props;
  const testId = props['data-testid'];

  const baseStyle: CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    borderLeft: `3px solid ${toneAccent[tone]}`,
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    textAlign: 'left',
    width: '100%',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'box-shadow var(--motion-duration-base) var(--motion-easing-out), transform var(--motion-duration-base) var(--motion-easing-out)',
  };

  const skeletonContent = (
    <Stack gap={2} style={{ width: '100%' }} aria-hidden="true">
      <div className="statcard-shimmer statcard-shimmer--label" />
      <div className="statcard-shimmer statcard-shimmer--value" />
      <div className="statcard-shimmer statcard-shimmer--caption" />
    </Stack>
  );

  const content = (
    <Stack gap={2} style={{ width: '100%' }}>
      <Inline gap={2} align="center" justify="between">
        <Inline gap={2} align="center">
          {icon !== undefined && (
            <span aria-hidden="true" style={{ color: 'var(--color-text-muted)', display: 'inline-flex' }}>
              {icon}
            </span>
          )}
          <Text variant="caption" color="secondary" weight="medium">
            {label}
          </Text>
        </Inline>
      </Inline>

      <Inline gap={1} align="baseline">
        <Text
          as="span"
          variant="display"
          weight="bold"
          color="primary"
          style={{ lineHeight: '1.1' }}
        >
          {value}
        </Text>
        {unit !== undefined && (
          <Text as="span" variant="title" color="muted" weight="medium">
            {unit}
          </Text>
        )}
      </Inline>

      {caption !== undefined && (
        <Text variant="caption" color="muted">
          {caption}
        </Text>
      )}

      {delta !== undefined && (
        <Inline gap={1} align="center">
          <span aria-hidden="true" style={{ color: deltaColor[delta.direction], fontWeight: 700 }}>
            {deltaArrow[delta.direction]}
          </span>
          <Text
            variant="caption"
            weight="semibold"
            style={{ color: deltaColor[delta.direction] }}
            data-delta={delta.direction}
          >
            {delta.text}
          </Text>
        </Inline>
      )}
    </Stack>
  );

  const body = loading ? skeletonContent : content;

  if (onClick && !loading) {
    const handleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    };
    return (
      <button
        type="button"
        className={`${className ?? ''} statcard-clickable`}
        data-testid={testId}
        data-tone={tone}
        onClick={onClick}
        onKeyDown={handleKey}
        aria-label={label}
        style={baseStyle}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={className}
      data-testid={testId}
      data-tone={tone}
      aria-busy={loading ? true : false}
      style={baseStyle}
    >
      {body}
    </div>
  );
}
