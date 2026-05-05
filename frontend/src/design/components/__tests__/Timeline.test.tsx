import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Timeline, type TimelineItem } from '../Timeline';

const items: TimelineItem[] = [
  { id: '1', title: 'Created', date: '2026-01-01', description: 'Project kicked off' },
  { id: '2', title: 'In Review', date: '2026-02-01', status: 'at-risk' },
  { id: '3', title: 'Shipped', date: '2026-03-01', status: 'done' },
];

describe('Timeline', () => {
  it('renders all items\' titles', () => {
    const { getByText } = render(<Timeline items={items} />);
    expect(getByText('Created')).toBeTruthy();
    expect(getByText('In Review')).toBeTruthy();
    expect(getByText('Shipped')).toBeTruthy();
  });

  it('renders date and description when provided', () => {
    const { getByText } = render(<Timeline items={items} />);
    expect(getByText('2026-01-01')).toBeTruthy();
    expect(getByText('Project kicked off')).toBeTruthy();
  });

  it('renders a StatusChip when item has status', () => {
    const { container } = render(<Timeline items={items} />);
    const chips = container.querySelectorAll('[data-status]');
    // items 2 and 3 have statuses
    expect(chips.length).toBe(2);
    const statuses = Array.from(chips).map((c) => c.getAttribute('data-status'));
    expect(statuses).toContain('at-risk');
    expect(statuses).toContain('done');
  });

  it('activeIndex marks the active item\'s dot with data-active="true" and glow shadow', () => {
    const { container } = render(<Timeline items={items} activeIndex={1} />);
    const activeDot = container.querySelector('[data-role="timeline-dot"][data-active="true"]');
    expect(activeDot).toBeTruthy();
    const el = activeDot as HTMLElement;
    expect(el.style.boxShadow).toContain('var(--shadow-glow)');

    const inactive = container.querySelectorAll('[data-role="timeline-dot"][data-active="false"]');
    expect(inactive.length).toBe(2);
  });

  it('orientation="horizontal" sets flex-direction: row on the container', () => {
    const { container } = render(
      <Timeline items={items} orientation="horizontal" data-testid="tl" />,
    );
    const root = container.querySelector('[data-testid="tl"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute('data-orientation')).toBe('horizontal');
    expect(root.style.flexDirection).toBe('row');
  });

  it('renders a custom icon when provided (overrides default dot content)', () => {
    const custom: TimelineItem[] = [
      { id: 'x', title: 'Custom', icon: <span data-testid="icn">*</span> },
    ];
    const { getByTestId } = render(<Timeline items={custom} />);
    expect(getByTestId('icn')).toBeTruthy();
  });

  it('passes className and data-testid to the root', () => {
    const { getByTestId } = render(
      <Timeline items={items} className="c" data-testid="t" />,
    );
    expect(getByTestId('t').className).toBe('c');
  });
});
