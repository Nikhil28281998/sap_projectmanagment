import { forwardRef, type Ref } from 'react';
import { Box, type BoxProps } from './Box';
import type { SpacingToken } from '../tokens/spacing';

type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';

const alignMap: Record<Align, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  stretch: 'stretch', baseline: 'baseline',
};
const justifyMap: Record<Justify, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around',
};

export type InlineProps = BoxProps & {
  gap?: SpacingToken;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
};

export const Inline = forwardRef(function Inline(
  { gap, align, justify, wrap, style, ...rest }: InlineProps,
  ref: Ref<HTMLElement>
) {
  return (
    <Box
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'row',
        ...(gap !== undefined && { gap: `var(--space-${gap})` }),
        ...(align !== undefined && { alignItems: alignMap[align] }),
        ...(justify !== undefined && { justifyContent: justifyMap[justify] }),
        ...(wrap && { flexWrap: 'wrap' }),
        ...style,
      }}
      {...rest}
    />
  );
}) as (props: InlineProps & { ref?: Ref<Element> }) => React.ReactElement | null;

(Inline as any).displayName = 'Inline';
