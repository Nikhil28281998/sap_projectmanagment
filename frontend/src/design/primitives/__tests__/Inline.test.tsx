import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Inline } from '../Inline';

describe('Inline', () => {
  it('renders row flex by default', () => {
    const { container } = render(<Inline>hi</Inline>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.display).toBe('flex');
    expect(el.style.flexDirection).toBe('row');
  });

  it('maps gap, align, justify', () => {
    const { container } = render(<Inline gap={3} align="center" justify="between">hi</Inline>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.gap).toBe('var(--space-3)');
    expect(el.style.alignItems).toBe('center');
    expect(el.style.justifyContent).toBe('space-between');
  });

  it('supports wrap', () => {
    const { container } = render(<Inline wrap>hi</Inline>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.flexWrap).toBe('wrap');
  });
});
