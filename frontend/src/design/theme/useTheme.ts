import { createContext, useContext } from 'react';
import type { ThemeName } from '../tokens/semantic';
import type { DensityMode } from '../tokens/density';

export type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  density: DensityMode;
  setDensity: (d: DensityMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
