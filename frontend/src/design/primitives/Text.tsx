import { forwardRef, type CSSProperties, type ElementType, type ReactNode, type Ref } from 'react';
import { typography, type TypographyScale } from '../tokens/typography';

type TextElement = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'label';
type TextColor = 'primary' | 'secondary' | 'muted' | 'inverse' | 'link';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
type Align = 'left' | 'center' | 'right';

const weightMap: Record<Weight, number> = {
  regular: 400, medium: 500, semibold: 600, bold: 700,
};

export type TextProps = {
  as?: TextElement;
  variant?: TypographyScale;
  color?: TextColor;
  weight?: Weight;
  mono?: boolean;
  align?: Align;
  truncate?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<React.HTMLAttributes<HTMLElement>, 'style' | 'color'>;

export const Text = forwardRef(function Text(
  {
    as: Component = 'span',
    variant = 'body',
    color,
    weight,
    mono,
    align,
    truncate,
    className,
    style: styleOverride,
    children,
    ...rest
  }: TextProps,
  ref: Ref<HTMLElement>
) {
  const scale = typography.scale[variant];
  const style: CSSProperties = {
    fontSize: scale.size,
    lineHeight: scale.line,
    fontWeight: weight !== undefined ? weightMap[weight] : scale.weight,
    fontFamily: mono ? typography.fontFamily.mono : typography.fontFamily.ui,
    ...(color !== undefined && { color: `var(--color-text-${color})` }),
    ...(align !== undefined && { textAlign: align }),
    ...(truncate && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    ...styleOverride,
  };

  const Tag = Component as ElementType;
  return (
    <Tag ref={ref} className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}) as (props: TextProps & { ref?: Ref<Element> }) => React.ReactElement | null;

(Text as any).displayName = 'Text';
