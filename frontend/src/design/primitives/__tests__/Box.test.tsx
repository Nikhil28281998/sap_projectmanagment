import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Box } from '../Box';

describe('Box', () => {
  it('renders a div by default', () => {
    const { container } = render(<Box>hi</Box>);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('supports polymorphic as= prop', () => {
    const { container } = render(<Box as="section">hi</Box>);
    expect(container.firstChild?.nodeName).toBe('SECTION');
  });

  it('maps padding tokens to CSS var style', () => {
    const { container } = render(<Box p={4}>hi</Box>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe('var(--space-4)');
  });

  it('maps px/py separately', () => {
    const { container } = render(<Box px={2} py={6}>hi</Box>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.paddingLeft).toBe('var(--space-2)');
    expect(el.style.paddingRight).toBe('var(--space-2)');
    expect(el.style.paddingTop).toBe('var(--space-6)');
    expect(el.style.paddingBottom).toBe('var(--space-6)');
  });

  it('maps bg to semantic background var', () => {
    const { container } = render(<Box bg="elevated">hi</Box>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.background).toBe('var(--color-bg-elevated)');
  });

  it('maps radius and shadow tokens', () => {
    const { container } = render(<Box radius="md" shadow="md">hi</Box>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.borderRadius).toBe('var(--radius-md)');
    expect(el.style.boxShadow).toBe('var(--shadow-md)');
  });

  it('maps border token to 1px solid with focus/default/subtle/strong', () => {
    const { container } = render(<Box border="default">hi</Box>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.border).toBe('1px solid var(--color-border-default)');
  });

  it('passes through className and children', () => {
    const { container } = render(<Box className="x">child</Box>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toBe('x');
    expect(el.textContent).toBe('child');
  });

  it('forwards ref', () => {
    let ref: Element | null = null;
    render(<Box ref={(r) => { ref = r; }}>hi</Box>);
    expect(ref).toBeInstanceOf(HTMLDivElement);
  });
});
