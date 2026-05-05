import { describe, it, expect } from 'vitest';
import { toCssVarName, themeToCssVars, staticCssVars } from '../cssVars';

describe('toCssVarName', () => {
  it('converts dot paths to kebab CSS var names', () => {
    expect(toCssVarName(['color', 'bg', 'app'])).toBe('--color-bg-app');
    expect(toCssVarName(['color', 'status', 'risk', 'high'])).toBe('--color-status-risk-high');
  });
});

describe('themeToCssVars', () => {
  it('produces a flat map of CSS var → value for dark theme', () => {
    const vars = themeToCssVars('dark');
    expect(vars['--color-bg-app']).toBeDefined();
    expect(vars['--color-text-primary']).toBeDefined();
    expect(vars['--color-status-risk-high']).toBeDefined();
  });

  it('dark and light produce different bg values', () => {
    const dark = themeToCssVars('dark');
    const light = themeToCssVars('light');
    expect(dark['--color-bg-app']).not.toBe(light['--color-bg-app']);
  });
});

describe('staticCssVars', () => {
  it('emits spacing, radius, motion, zIndex vars', () => {
    const vars = staticCssVars();
    expect(vars['--space-4']).toBe('16px');
    expect(vars['--radius-md']).toBe('6px');
    expect(vars['--motion-duration-base']).toBe('200ms');
    expect(vars['--z-modal']).toBeDefined();
  });
});
