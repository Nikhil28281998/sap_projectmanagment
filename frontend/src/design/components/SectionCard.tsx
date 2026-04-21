import { type CSSProperties, type ReactNode, createElement } from 'react';
import { Text } from '../primitives/Text';

export type SectionCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
  className?: string;
  as?: 'section' | 'article' | 'div';
  'data-testid'?: string;
};

export function SectionCard(props: SectionCardProps) {
  const {
    title,
    description,
    actions,
    children,
    noPadding = false,
    className,
    as = 'section',
  } = props;
  const testId = props['data-testid'];

  const rootStyle: CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-4)',
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--color-border-subtle)',
  };

  const contentStyle: CSSProperties = noPadding
    ? {}
    : { padding: 'var(--space-5)' };

  const hasHeader = title !== undefined || description !== undefined || actions !== undefined;

  return createElement(
    as,
    { className, 'data-testid': testId, style: rootStyle },
    hasHeader && (
      <div data-role="header" style={headerStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
          {title !== undefined && (
            <Text as="h2" variant="title" weight="semibold" color="primary">
              {title}
            </Text>
          )}
          {description !== undefined && (
            <Text variant="body" color="secondary">
              {description}
            </Text>
          )}
        </div>
        {actions !== undefined && (
          <div data-role="actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    ),
    <div data-role="content" style={contentStyle}>
      {children}
    </div>,
  );
}
