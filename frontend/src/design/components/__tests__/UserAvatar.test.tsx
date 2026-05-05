import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { UserAvatar, getInitials, colorForName } from '../UserAvatar';

describe('UserAvatar', () => {
  it('initials from "Nikhil Kumar" are "NK"', () => {
    expect(getInitials('Nikhil Kumar')).toBe('NK');
    const { container } = render(<UserAvatar name="Nikhil Kumar" />);
    const circle = container.querySelector('[data-role="avatar-circle"]');
    expect(circle?.textContent).toBe('NK');
  });

  it('single-word names produce 1 initial', () => {
    expect(getInitials('Alice')).toBe('A');
    const { container } = render(<UserAvatar name="Alice" />);
    const circle = container.querySelector('[data-role="avatar-circle"]');
    expect(circle?.textContent).toBe('A');
  });

  it('same name produces the same color (determinism)', () => {
    const a = colorForName('Charlie Brown');
    const b = colorForName('Charlie Brown');
    expect(a).toBe(b);
  });

  it('different names produce different colors (Alice vs Bob)', () => {
    expect(colorForName('Alice')).not.toBe(colorForName('Bob'));
  });

  it('showName toggles name visibility', () => {
    const shown = render(<UserAvatar name="Alice" showName />);
    const hidden = render(<UserAvatar name="Alice" />);
    expect(shown.container.querySelector('[data-role="avatar-name"]')).toBeTruthy();
    expect(hidden.container.querySelector('[data-role="avatar-name"]')).toBeNull();
  });

  it('color is always a CSS variable (not hex)', () => {
    const c = colorForName('Anybody');
    expect(c.startsWith('var(--')).toBe(true);
  });

  it('email appears in title tooltip', () => {
    const { container } = render(
      <UserAvatar name="Alice" email="alice@example.com" />,
    );
    const root = container.querySelector('[data-role="user-avatar"]');
    expect(root?.getAttribute('title')).toContain('alice@example.com');
  });

  it('passes className and data-testid', () => {
    const { getByTestId } = render(
      <UserAvatar name="X" className="c" data-testid="t" />,
    );
    expect(getByTestId('t').className).toBe('c');
  });
});
