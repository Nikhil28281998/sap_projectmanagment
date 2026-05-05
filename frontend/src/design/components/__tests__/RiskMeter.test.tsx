import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RiskMeter } from '../RiskMeter';

describe('RiskMeter', () => {
  it('score=0 uses risk-low var and numeric label "0"', () => {
    const { container, getByText } = render(<RiskMeter score={0} />);
    expect(getByText('0')).toBeTruthy();
    const fill = container.querySelector('[data-role="risk-fill"]') as HTMLElement;
    expect(fill.style.background).toContain('var(--color-status-risk-low)');
    expect(fill.style.width).toBe('0%');
  });

  it('score=75 uses risk-high var and width "75%"', () => {
    const { container } = render(<RiskMeter score={75} />);
    const fill = container.querySelector('[data-role="risk-fill"]') as HTMLElement;
    expect(fill.style.background).toContain('var(--color-status-risk-high)');
    expect(fill.style.width).toBe('75%');
  });

  it('score=150 with default clamp clamps to 100', () => {
    const { container, getByText } = render(<RiskMeter score={150} />);
    expect(getByText('100')).toBeTruthy();
    const fill = container.querySelector('[data-role="risk-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('score=-10 with default clamp clamps to 0', () => {
    const { container, getByText } = render(<RiskMeter score={-10} />);
    expect(getByText('0')).toBeTruthy();
    const fill = container.querySelector('[data-role="risk-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('score=50 uses risk-medium var', () => {
    const { container } = render(<RiskMeter score={50} />);
    const fill = container.querySelector('[data-role="risk-fill"]') as HTMLElement;
    expect(fill.style.background).toContain('var(--color-status-risk-medium)');
  });

  it('has meter role with aria values', () => {
    const { getByRole } = render(<RiskMeter score={42} label="Risk" />);
    const meter = getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('42');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
  });
});
