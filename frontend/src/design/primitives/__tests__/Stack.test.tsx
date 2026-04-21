import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Stack } from '../Stack';

describe('Stack', () => {
  it('renders vertical flex by default', () => {
    const { container } = render(<Stack>hi</Stack>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.display).toBe('flex');
    expect(el.style.flexDirection).toBe('column');
  });

  it('maps gap to token var', () => {
    const { container } = render(<Stack gap={4}>hi</Stack>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.gap).toBe('var(--space-4)');
  });

  it('maps align and justify', () => {
    const { container } = render(<Stack align="center" justify="between">hi</Stack>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.alignItems).toBe('center');
    expect(el.style.justifyContent).toBe('space-between');
  });

  it('inherits Box props (p, bg)', () => {
    const { container } = render(<Stack p={2} bg="elevated">hi</Stack>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.padding).toBe('var(--space-2)');
    expect(el.style.background).toBe('var(--color-bg-elevated)');
  });
});
