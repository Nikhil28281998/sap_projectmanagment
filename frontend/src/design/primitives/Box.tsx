import {
  forwardRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from 'react';
import type { SpacingToken } from '../tokens/spacing';
import type { RadiusToken } from '../tokens/radius';
import type { ShadowToken } from '../tokens/shadow';

type BgToken = 'app' | 'elevated' | 'raised' | 'surface' | 'surface-subtle' | 'surface-muted';
type BorderToken = 'subtle' | 'default' | 'strong';
type TextColorToken = 'primary' | 'secondary' | 'muted' | 'inverse';

export type BoxProps = {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;

  p?: SpacingToken;  px?: SpacingToken;  py?: SpacingToken;
  pt?: SpacingToken; pr?: SpacingToken; pb?: SpacingToken; pl?: SpacingToken;

  m?: SpacingToken;  mx?: SpacingToken;  my?: SpacingToken;
  mt?: SpacingToken; mr?: SpacingToken; mb?: SpacingToken; ml?: SpacingToken;

  bg?: BgToken;
  radius?: RadiusToken;
  shadow?: ShadowToken;
  border?: BorderToken;
  color?: TextColorToken;

  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'style' | 'color'>;

const bgVar: Record<BgToken, string> = {
  'app':              'var(--color-bg-app)',
  'elevated':         'var(--color-bg-elevated)',
  'raised':           'var(--color-bg-raised)',
  'surface':          'var(--color-surface-base)',
  'surface-subtle':   'var(--color-surface-subtle)',
  'surface-muted':    'var(--color-surface-muted)',
};

function spaceVar(v?: SpacingToken): string | undefined {
  return v === undefined ? undefined : `var(--space-${v})`;
}

export const Box = forwardRef(function Box(
  props: BoxProps,
  ref: Ref<HTMLElement>
) {
  const {
    as: Component = 'div',
    children,
    className,
    style: styleOverride,
    p, px, py, pt, pr, pb, pl,
    m, mx, my, mt, mr, mb, ml,
    bg, radius, shadow, border, color,
    width, height, minWidth, minHeight, maxWidth, maxHeight,
    ...rest
  } = props;

  const style: CSSProperties = {
    ...(p !== undefined && { padding: spaceVar(p) }),
    ...(px !== undefined && { paddingLeft: spaceVar(px), paddingRight: spaceVar(px) }),
    ...(py !== undefined && { paddingTop: spaceVar(py), paddingBottom: spaceVar(py) }),
    ...(pt !== undefined && { paddingTop: spaceVar(pt) }),
    ...(pr !== undefined && { paddingRight: spaceVar(pr) }),
    ...(pb !== undefined && { paddingBottom: spaceVar(pb) }),
    ...(pl !== undefined && { paddingLeft: spaceVar(pl) }),

    ...(m !== undefined && { margin: spaceVar(m) }),
    ...(mx !== undefined && { marginLeft: spaceVar(mx), marginRight: spaceVar(mx) }),
    ...(my !== undefined && { marginTop: spaceVar(my), marginBottom: spaceVar(my) }),
    ...(mt !== undefined && { marginTop: spaceVar(mt) }),
    ...(mr !== undefined && { marginRight: spaceVar(mr) }),
    ...(mb !== undefined && { marginBottom: spaceVar(mb) }),
    ...(ml !== undefined && { marginLeft: spaceVar(ml) }),

    ...(bg !== undefined && { background: bgVar[bg] }),
    ...(radius !== undefined && { borderRadius: `var(--radius-${radius})` }),
    ...(shadow !== undefined && { boxShadow: `var(--shadow-${shadow})` }),
    ...(border !== undefined && { border: `1px solid var(--color-border-${border})` }),
    ...(color !== undefined && { color: `var(--color-text-${color})` }),

    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(minWidth !== undefined && { minWidth }),
    ...(minHeight !== undefined && { minHeight }),
    ...(maxWidth !== undefined && { maxWidth }),
    ...(maxHeight !== undefined && { maxHeight }),

    ...styleOverride,
  };

  return (
    <Component ref={ref} className={className} style={style} {...rest}>
      {children}
    </Component>
  );
}) as <E extends ElementType = 'div'>(
  props: BoxProps & { ref?: Ref<Element> }
) => React.ReactElement | null;

(Box as any).displayName = 'Box';
