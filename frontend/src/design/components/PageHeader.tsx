import { type CSSProperties, type ReactNode, Fragment } from 'react';
import { Text } from '../primitives/Text';

export type PageHeaderProps = {
  breadcrumb?: { label: string; href?: string }[];
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  'data-testid'?: string;
};

export function PageHeader(props: PageHeaderProps) {
  const { breadcrumb, title, description, actions, className } = props;
  const testId = props['data-testid'];

  const rootStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    paddingBottom: 'var(--space-5)',
  };

  const rowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
  };

  const linkStyle: CSSProperties = {
    color: 'var(--color-text-link)',
    textDecoration: 'none',
  };

  const sepStyle: CSSProperties = {
    color: 'var(--color-text-muted)',
  };

  return (
    <div
      className={className}
      data-testid={testId}
      data-role="page-header"
      style={rootStyle}
    >
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="breadcrumb" data-role="breadcrumb">
          <Text variant="caption" color="muted">
            {breadcrumb.map((item, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <Fragment key={`${item.label}-${i}`}>
                  {i > 0 && <span style={sepStyle}> / </span>}
                  {isLast || item.href === undefined ? (
                    <span data-role="crumb" data-last={isLast ? 'true' : 'false'}>
                      {item.label}
                    </span>
                  ) : (
                    <a
                      href={item.href}
                      style={linkStyle}
                      data-role="crumb"
                      data-last="false"
                    >
                      {item.label}
                    </a>
                  )}
                </Fragment>
              );
            })}
          </Text>
        </nav>
      )}

      <div style={rowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0, flex: 1 }}>
          <Text as="h1" variant="headline" weight="bold" color="primary">
            {title}
          </Text>
          {description !== undefined && (
            <Text variant="body" color="secondary">
              {description}
            </Text>
          )}
        </div>
        {actions !== undefined && (
          <div
            data-role="actions"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
