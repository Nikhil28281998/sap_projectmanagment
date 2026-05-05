import { type CSSProperties, type ReactNode } from 'react';
import { Stack } from '../primitives/Stack';
import { Text } from '../primitives/Text';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  'data-testid'?: string;
};

const sizePadding = { sm: 4, md: 6, lg: 10 } as const;
const iconSize = { sm: 40, md: 56, lg: 72 } as const;

export function EmptyState(props: EmptyStateProps) {
  const { icon, title, description, action, size = 'md', className } = props;
  const testId = props['data-testid'];

  const iconPx = iconSize[size];
  const iconStyle: CSSProperties = {
    color: 'var(--color-text-muted)',
    fontSize: iconPx,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: iconPx,
    height: iconPx,
  };

  const buttonStyle: CSSProperties = {
    background: 'var(--color-accent-primary)',
    color: 'var(--color-accent-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background var(--motion-duration-base) var(--motion-easing-out)',
  };

  return (
    <Stack
      gap={3}
      align="center"
      p={sizePadding[size]}
      className={className}
      data-testid={testId}
      style={{ textAlign: 'center' }}
    >
      {icon !== undefined && (
        <span aria-hidden="true" data-role="icon" style={iconStyle}>
          {icon}
        </span>
      )}
      <Text as="h3" variant="title" weight="semibold" color="primary">
        {title}
      </Text>
      {description !== undefined && (
        <Text variant="body" color="secondary" style={{ maxWidth: 420 }}>
          {description}
        </Text>
      )}
      {action !== undefined && (
        <button
          type="button"
          onClick={action.onClick}
          style={buttonStyle}
          data-role="action"
        >
          {action.label}
        </button>
      )}
    </Stack>
  );
}
