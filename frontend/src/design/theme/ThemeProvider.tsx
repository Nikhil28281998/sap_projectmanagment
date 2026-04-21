import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { ThemeContext, type ThemeContextValue } from './useTheme';
import { getAntdTheme } from './antdTheme';
import { themeToCssVars, staticCssVars, cssVarString } from './cssVars';
import { THEMES, type ThemeName } from '../tokens/semantic';
import { DENSITY_MODES, type DensityMode } from '../tokens/density';

const THEME_KEY = 'ui.theme';
const DENSITY_KEY = 'ui.density';
const STYLE_ID = 'design-system-vars';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : fallback;
}

function injectCssVars() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const statics = staticCssVars();
  const dark = themeToCssVars('dark');
  const light = themeToCssVars('light');
  el.textContent = `
:root {
  ${cssVarString(statics)}
}
:root[data-theme="dark"] {
  ${cssVarString(dark)}
}
:root[data-theme="light"] {
  ${cssVarString(light)}
}
`.trim();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    readStored<ThemeName>(THEME_KEY, THEMES, 'dark')
  );
  const [density, setDensityState] = useState<DensityMode>(() =>
    readStored<DensityMode>(DENSITY_KEY, DENSITY_MODES, 'comfortable')
  );

  useEffect(() => { injectCssVars(); }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  const value: ThemeContextValue = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      density,
      setDensity: setDensityState,
    }),
    [theme, density]
  );

  const antdTheme = useMemo(() => getAntdTheme(theme), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}
