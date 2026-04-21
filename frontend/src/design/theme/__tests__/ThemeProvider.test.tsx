import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from '../ThemeProvider';
import { useTheme } from '../useTheme';

function Probe() {
  const { theme, setTheme, density, setDensity } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="density">{density}</span>
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>toggle</button>
      <button onClick={() => setDensity('compact')}>compact</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    localStorage.clear();
  });

  it('defaults to dark theme and comfortable density', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('density').textContent).toBe('comfortable');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.density).toBe('comfortable');
  });

  it('setTheme flips the data-theme attribute on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('setDensity flips the data-density attribute on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByText('compact').click());
    expect(document.documentElement.dataset.density).toBe('compact');
  });

  it('persists theme and density in localStorage', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    act(() => screen.getByText('compact').click());
    expect(localStorage.getItem('ui.theme')).toBe('light');
    expect(localStorage.getItem('ui.density')).toBe('compact');
  });

  it('injects CSS variables for the active theme into <head>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    const style = document.getElementById('design-system-vars');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('--color-bg-app');
  });
});
