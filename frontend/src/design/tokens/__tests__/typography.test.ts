import { describe, it, expect } from 'vitest';
import { typography } from '../typography';

describe('typography tokens', () => {
  it('exposes ui and mono font stacks', () => {
    expect(typography.fontFamily.ui).toContain('Inter');
    expect(typography.fontFamily.mono).toContain('JetBrains Mono');
  });

  it('exposes a type scale from caption to displayLg', () => {
    expect(typography.scale.caption.size).toBe('12px');
    expect(typography.scale.body.size).toBe('14px');
    expect(typography.scale.bodyLg.size).toBe('16px');
    expect(typography.scale.title.size).toBe('20px');
    expect(typography.scale.headline.size).toBe('28px');
    expect(typography.scale.display.size).toBe('36px');
    expect(typography.scale.displayLg.size).toBe('48px');
  });

  it('every scale entry has size, line, weight', () => {
    Object.values(typography.scale).forEach((v) => {
      expect(v.size).toMatch(/^\d+px$/);
      expect(v.line).toMatch(/^\d+px$/);
      expect(typeof v.weight).toBe('number');
    });
  });
});
