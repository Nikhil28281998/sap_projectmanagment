import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    const { getByText } = render(<StatCard label="Active Users" value={1234} />);
    expect(getByText('Active Users')).toBeTruthy();
    expect(getByText('1234')).toBeTruthy();
  });

  it('maps tone="danger" to a data-tone attribute with danger border color', () => {
    const { getByTestId } = render(
      <StatCard label="Errors" value={5} tone="danger" data-testid="card" />,
    );
    const el = getByTestId('card');
    expect(el.getAttribute('data-tone')).toBe('danger');
    expect(el.style.borderLeft).toContain('var(--color-status-danger-fg)');
  });

  it('when onClick is set, renders as button and is keyboard-activatable', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(
      <StatCard label="Click" value={1} onClick={onClick} data-testid="c" />,
    );
    const el = getByTestId('c');
    expect(el.tagName).toBe('BUTTON');
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('delta direction up uses low-risk color; down uses high-risk color', () => {
    const up = render(
      <StatCard
        label="A"
        value={1}
        delta={{ direction: 'up', text: '+5%' }}
        data-testid="up"
      />,
    );
    const down = render(
      <StatCard
        label="B"
        value={1}
        delta={{ direction: 'down', text: '-5%' }}
        data-testid="down"
      />,
    );
    const upEl = up.container.querySelector('[data-delta="up"]') as HTMLElement;
    const downEl = down.container.querySelector('[data-delta="down"]') as HTMLElement;
    expect(upEl.style.color).toContain('var(--color-status-risk-low)');
    expect(downEl.style.color).toContain('var(--color-status-risk-high)');
  });

  it('passes through className and data-testid', () => {
    const { getByTestId } = render(
      <StatCard label="x" value={1} className="my-cls" data-testid="t" />,
    );
    const el = getByTestId('t');
    expect(el.className).toBe('my-cls');
  });
});
