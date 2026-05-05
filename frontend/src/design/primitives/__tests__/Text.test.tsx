import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Text } from '../Text';

describe('Text', () => {
  it('renders span by default', () => {
    const { container } = render(<Text>hi</Text>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('renders the given element via as=', () => {
    const { container } = render(<Text as="h1">hi</Text>);
    expect(container.firstChild?.nodeName).toBe('H1');
  });

  it('applies body scale by default sizes and line-height', () => {
    const { container } = render(<Text>hi</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('14px');
    expect(el.style.lineHeight).toBe('20px');
  });

  it('applies headline scale', () => {
    const { container } = render(<Text variant="headline">hi</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('28px');
    expect(el.style.lineHeight).toBe('36px');
  });

  it('maps color to semantic text var', () => {
    const { container } = render(<Text color="muted">hi</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toBe('var(--color-text-muted)');
  });

  it('applies mono font family', () => {
    const { container } = render(<Text mono>TRK900</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontFamily).toContain('JetBrains Mono');
  });

  it('supports truncate', () => {
    const { container } = render(<Text truncate>long text</Text>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.overflow).toBe('hidden');
    expect(el.style.textOverflow).toBe('ellipsis');
    expect(el.style.whiteSpace).toBe('nowrap');
  });
});
