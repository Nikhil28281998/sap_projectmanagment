import { semantic, type ThemeName } from '../tokens/semantic';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/radius';
import { motion } from '../tokens/motion';
import { zIndex } from '../tokens/zIndex';
import { shadow } from '../tokens/shadow';

export function toCssVarName(path: readonly string[]): string {
  return `--${path.join('-')}`;
}

function flatten(
  obj: Record<string, unknown>,
  prefix: readonly string[] = []
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = [...prefix, k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, path));
    } else {
      out[toCssVarName(path)] = String(v);
    }
  }
  return out;
}

export function themeToCssVars(theme: ThemeName): Record<string, string> {
  const themeShadow = shadow[theme];
  const vars = flatten(semantic[theme]);
  for (const [k, v] of Object.entries(themeShadow)) {
    vars[`--shadow-${k}`] = v;
  }
  return vars;
}

export function staticCssVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(spacing)) {
    out[`--space-${k}`] = v;
  }
  for (const [k, v] of Object.entries(radius)) {
    out[`--radius-${k}`] = v;
  }
  for (const [k, v] of Object.entries(motion.duration)) {
    out[`--motion-duration-${k}`] = v;
  }
  for (const [k, v] of Object.entries(motion.easing)) {
    out[`--motion-easing-${k}`] = v;
  }
  for (const [k, v] of Object.entries(zIndex)) {
    out[`--z-${k}`] = String(v);
  }
  return out;
}

export function cssVarString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n  ');
}
