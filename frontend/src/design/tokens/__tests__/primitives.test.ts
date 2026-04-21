import { describe, it, expect } from 'vitest';
import { primitives } from '../primitives';
import { spacing } from '../spacing';
import { radius } from '../radius';
import { shadow } from '../shadow';
import { motion } from '../motion';
import { zIndex } from '../zIndex';

describe('primitive tokens', () => {
  it('has a full slate scale 50–950', () => {
    expect(primitives.slate[50]).toBeDefined();
    expect(primitives.slate[900]).toBeDefined();
    expect(primitives.slate[950]).toBeDefined();
  });

  it('has teal, rose, amber, emerald, inkBlue scales', () => {
    expect(primitives.teal[400]).toBe('#22D3EE');
    expect(primitives.teal[500]).toBe('#06B6D4');
    expect(primitives.rose[500]).toBe('#F43F5E');
    expect(primitives.amber[500]).toBe('#F59E0B');
    expect(primitives.emerald[500]).toBe('#10B981');
    expect(primitives.inkBlue[700]).toBe('#1E40AF');
  });
});

describe('spacing tokens', () => {
  it('is a 4px base grid', () => {
    expect(spacing[1]).toBe('4px');
    expect(spacing[2]).toBe('8px');
    expect(spacing[4]).toBe('16px');
    expect(spacing[8]).toBe('32px');
  });
});

describe('radius tokens', () => {
  it('exposes sm/md/lg/xl/pill', () => {
    expect(radius.sm).toBe('4px');
    expect(radius.md).toBe('6px');
    expect(radius.lg).toBe('10px');
    expect(radius.xl).toBe('16px');
    expect(radius.pill).toBe('9999px');
  });
});

describe('shadow tokens', () => {
  it('exposes sm/md/lg/xl for both themes', () => {
    expect(shadow.dark.md).toContain('rgba');
    expect(shadow.light.md).toContain('rgba');
  });
});

describe('motion tokens', () => {
  it('defines durations and easings', () => {
    expect(motion.duration.fast).toBe('150ms');
    expect(motion.duration.base).toBe('200ms');
    expect(motion.easing.out).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });
});

describe('zIndex tokens', () => {
  it('has ordered layer values', () => {
    expect(zIndex.base).toBeLessThan(zIndex.dropdown);
    expect(zIndex.dropdown).toBeLessThan(zIndex.modal);
    expect(zIndex.modal).toBeLessThan(zIndex.toast);
  });
});
