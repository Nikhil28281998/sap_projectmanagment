import { type CSSProperties } from 'react';

export type UserAvatarRole = 'Admin' | 'Manager' | 'Developer' | 'Executive';

export type UserAvatarProps = {
  name: string;
  email?: string;
  role?: UserAvatarRole;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
  'data-testid'?: string;
};

const sizePx = { sm: 24, md: 32, lg: 40 } as const;
const fontPx = { sm: 10, md: 12, lg: 14 } as const;

const palette: readonly string[] = [
  'var(--color-accent-primary)',
  'var(--color-status-risk-low)',
  'var(--color-status-risk-medium)',
  'var(--color-status-info-fg)',
  'var(--color-text-link)',
  'var(--color-status-risk-high)',
] as const;

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForName(name: string): string {
  return palette[hashName(name) % palette.length];
}

export function UserAvatar(props: UserAvatarProps) {
  const {
    name,
    email,
    role,
    size = 'md',
    showName = false,
    className,
  } = props;
  const testId = props['data-testid'];

  const px = sizePx[size];
  const initials = getInitials(name);
  const bg = colorForName(name);

  const circleStyle: CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    background: bg,
    color: 'var(--color-accent-on-primary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontPx[size],
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
    userSelect: 'none',
  };

  const wrapStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  };

  const roleChipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 'var(--radius-pill)',
    background: 'var(--color-surface-muted)',
    color: 'var(--color-text-secondary)',
    fontSize: '11px',
    fontWeight: 600,
    border: '1px solid var(--color-border-subtle)',
  };

  const tooltip = email !== undefined ? `${name} (${email})` : name;

  return (
    <span
      className={className}
      data-testid={testId}
      data-role="user-avatar"
      title={tooltip}
      style={wrapStyle}
    >
      <span
        aria-label={name}
        data-role="avatar-circle"
        data-color={bg}
        style={circleStyle}
      >
        {initials}
      </span>
      {showName && (
        <span
          data-role="avatar-name"
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
          }}
        >
          {name}
        </span>
      )}
      {role !== undefined && showName && (
        <span data-role="avatar-role" style={roleChipStyle}>
          {role}
        </span>
      )}
    </span>
  );
}
