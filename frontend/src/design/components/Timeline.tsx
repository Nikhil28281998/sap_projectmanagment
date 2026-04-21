import { type CSSProperties, type ReactNode } from 'react';
import { Stack } from '../primitives/Stack';
import { Inline } from '../primitives/Inline';
import { Text } from '../primitives/Text';
import { StatusChip, type StatusChipStatus } from './StatusChip';

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  date?: string;
  status?: StatusChipStatus;
  icon?: ReactNode;
};

type Orientation = 'vertical' | 'horizontal';

export type TimelineProps = {
  items: TimelineItem[];
  activeIndex?: number;
  orientation?: Orientation;
  className?: string;
  'data-testid'?: string;
};

const statusDotColor: Record<StatusChipStatus, string> = {
  'on-track': 'var(--color-status-risk-low)',
  done: 'var(--color-status-risk-low)',
  'at-risk': 'var(--color-status-risk-medium)',
  pending: 'var(--color-status-risk-medium)',
  critical: 'var(--color-status-risk-high)',
  blocked: 'var(--color-status-risk-blocked)',
  'in-progress': 'var(--color-status-info-fg)',
};

function dotColor(status: StatusChipStatus | undefined): string {
  return status !== undefined ? statusDotColor[status] : 'var(--color-accent-primary)';
}

function Dot(props: { item: TimelineItem; active: boolean }): JSX.Element {
  const { item, active } = props;
  const base: CSSProperties = {
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: dotColor(item.status),
    border: '2px solid var(--color-bg-elevated)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    boxShadow: active ? 'var(--shadow-glow)' : 'none',
  };
  if (item.icon !== undefined) {
    return (
      <span data-role="timeline-dot" data-active={active ? 'true' : 'false'} style={{ ...base, background: 'transparent', border: 'none' }}>
        {item.icon}
      </span>
    );
  }
  return <span data-role="timeline-dot" data-active={active ? 'true' : 'false'} style={base} />;
}

function VerticalItem(props: { item: TimelineItem; active: boolean; last: boolean }): JSX.Element {
  const { item, active, last } = props;
  const railStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: '0 0 auto',
    gap: 'var(--space-1)',
  };
  const lineStyle: CSSProperties = {
    flex: '1 1 auto',
    width: 2,
    minHeight: 24,
    background: 'var(--color-border-default)',
  };
  return (
    <div data-role="timeline-item" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'stretch' }}>
      <div style={railStyle}>
        <Dot item={item} active={active} />
        {!last && <div data-role="timeline-line" style={lineStyle} />}
      </div>
      <Stack gap={1} style={{ paddingBottom: last ? 0 : 'var(--space-4)', flex: '1 1 auto', minWidth: 0 }}>
        <Inline gap={2} align="center" justify="between">
          <Text variant="body" weight="semibold" color="primary">
            {item.title}
          </Text>
          {item.status !== undefined && <StatusChip status={item.status} size="sm" />}
        </Inline>
        {item.date !== undefined && (
          <Text variant="caption" color="muted">
            {item.date}
          </Text>
        )}
        {item.description !== undefined && (
          <Text variant="body" color="secondary">
            {item.description}
          </Text>
        )}
      </Stack>
    </div>
  );
}

function HorizontalItem(props: { item: TimelineItem; active: boolean; last: boolean }): JSX.Element {
  const { item, active, last } = props;
  return (
    <div data-role="timeline-item" style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
      <Stack gap={1} align="center" style={{ minWidth: 120 }}>
        <Dot item={item} active={active} />
        <Text variant="body" weight="semibold" color="primary" align="center">
          {item.title}
        </Text>
        {item.date !== undefined && (
          <Text variant="caption" color="muted" align="center">
            {item.date}
          </Text>
        )}
        {item.status !== undefined && <StatusChip status={item.status} size="sm" />}
        {item.description !== undefined && (
          <Text variant="caption" color="secondary" align="center">
            {item.description}
          </Text>
        )}
      </Stack>
      {!last && (
        <div
          data-role="timeline-line"
          style={{ height: 2, minWidth: 32, flex: '1 1 auto', background: 'var(--color-border-default)', marginInline: 'var(--space-2)' }}
        />
      )}
    </div>
  );
}

export function Timeline(props: TimelineProps) {
  const { items, activeIndex, orientation = 'vertical', className } = props;
  const testId = props['data-testid'];

  const rootStyle: CSSProperties = {
    display: 'flex',
    flexDirection: orientation === 'horizontal' ? 'row' : 'column',
    alignItems: orientation === 'horizontal' ? 'flex-start' : 'stretch',
    width: '100%',
  };

  return (
    <div
      className={className}
      data-testid={testId}
      data-orientation={orientation}
      style={rootStyle}
    >
      {items.map((item, i) => {
        const active = activeIndex === i;
        const last = i === items.length - 1;
        return orientation === 'horizontal' ? (
          <HorizontalItem key={item.id} item={item} active={active} last={last} />
        ) : (
          <VerticalItem key={item.id} item={item} active={active} last={last} />
        );
      })}
    </div>
  );
}
