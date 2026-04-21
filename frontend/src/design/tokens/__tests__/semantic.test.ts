import { describe, it, expect } from 'vitest';
import { semantic, THEMES, type ThemeName } from '../semantic';

describe('semantic tokens', () => {
  it('defines both dark and light themes', () => {
    expect(THEMES).toEqual(['dark', 'light']);
  });

  it('each theme exposes bg, surface, text, border, status, accent groups', () => {
    (THEMES as readonly ThemeName[]).forEach((t) => {
      const s = semantic[t];
      expect(s.color.bg.app).toMatch(/^#|rgb/);
      expect(s.color.surface.base).toBeDefined();
      expect(s.color.text.primary).toBeDefined();
      expect(s.color.border.subtle).toBeDefined();
      expect(s.color.status.risk.high).toBeDefined();
      expect(s.color.accent.primary).toBeDefined();
    });
  });

  it('dark and light have distinct bg values', () => {
    expect(semantic.dark.color.bg.app).not.toBe(semantic.light.color.bg.app);
  });
});
