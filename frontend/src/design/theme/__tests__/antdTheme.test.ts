import { describe, it, expect } from 'vitest';
import { getAntdTheme } from '../antdTheme';
import { theme as antdAlgo } from 'antd';

describe('getAntdTheme', () => {
  it('returns dark algorithm for dark theme', () => {
    const t = getAntdTheme('dark');
    expect(t.algorithm).toBe(antdAlgo.darkAlgorithm);
  });

  it('returns default algorithm for light theme', () => {
    const t = getAntdTheme('light');
    expect(t.algorithm).toBe(antdAlgo.defaultAlgorithm);
  });

  it('maps semantic tokens into AntD token slots', () => {
    const t = getAntdTheme('dark');
    expect(t.token?.colorPrimary).toBeDefined();
    expect(t.token?.colorBgBase).toBeDefined();
    expect(t.token?.colorTextBase).toBeDefined();
    expect(t.token?.borderRadius).toBe(6);
    expect(t.token?.fontFamily).toContain('Inter');
  });
});
