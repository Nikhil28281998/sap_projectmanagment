import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusChip, type StatusChipStatus } from '../StatusChip';

const allStatuses: { status: StatusChipStatus; label: string }[] = [
  { status: 'on-track', label: 'On Track' },
  { status: 'at-risk', label: 'At Risk' },
  { status: 'critical', label: 'Critical' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'done', label: 'Done' },
  { status: 'pending', label: 'Pending' },
  { status: 'in-progress', label: 'In Progress' },
];

describe('StatusChip', () => {
  it('renders default label for each status', () => {
    for (const { status, label } of allStatuses) {
      const { getByText, unmount } = render(<StatusChip status={status} />);
      expect(getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it('label prop overrides default text', () => {
    const { getByText, queryByText } = render(
      <StatusChip status="on-track" label="Custom" />,
    );
    expect(getByText('Custom')).toBeTruthy();
    expect(queryByText('On Track')).toBeNull();
  });

  it('status dot color is a CSS variable (not hex)', () => {
    const { container } = render(<StatusChip status="critical" />);
    const dot = container.querySelector('[data-role="dot"]') as HTMLElement;
    expect(dot).toBeTruthy();
    expect(dot.style.background).toContain('var(--color-status-risk-');
    expect(dot.style.background).not.toMatch(/#[0-9a-f]/i);
  });

  it('size="sm" applies smaller padding', () => {
    const sm = render(<StatusChip status="done" size="sm" data-testid="sm" />);
    const md = render(<StatusChip status="done" size="md" data-testid="md" />);
    const smEl = sm.getByTestId('sm');
    const mdEl = md.getByTestId('md');
    expect(smEl.style.padding).toBe('2px 8px');
    expect(mdEl.style.padding).toBe('4px 10px');
  });

  it('passes className', () => {
    const { getByTestId } = render(
      <StatusChip status="done" className="c" data-testid="t" />,
    );
    expect(getByTestId('t').className).toBe('c');
  });
});
