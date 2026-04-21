import { describe, it, expect } from 'vitest';
import { density, DENSITY_MODES } from '../density';

describe('density tokens', () => {
  it('exposes three modes', () => {
    expect(DENSITY_MODES).toEqual(['comfortable', 'compact', 'dense']);
  });

  it('comfortable has larger row height than dense', () => {
    expect(parseInt(density.comfortable.rowHeight)).toBeGreaterThan(
      parseInt(density.dense.rowHeight)
    );
  });

  it('each mode has rowHeight, controlHeight, paddingY', () => {
    DENSITY_MODES.forEach((mode) => {
      expect(density[mode].rowHeight).toMatch(/px$/);
      expect(density[mode].controlHeight).toMatch(/px$/);
      expect(density[mode].paddingY).toMatch(/px$/);
    });
  });
});
