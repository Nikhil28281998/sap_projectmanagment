import { forwardRef, type Ref } from 'react';
import { Box, type BoxProps } from './Box';
import type { SpacingToken } from '../tokens/spacing';

type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around';

const alignMap: Record<Align, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
};
const justifyMap: Record<Justify, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around',
};

export type StackProps = BoxProps & {
  gap?: SpacingToken;
  align?: Align;
  justify?: Justify;
};

export const Stack = forwardRef(function Stack(
  { gap, align, justify, style, ...rest }: StackProps,
  ref: Ref<HTMLElement>
) {
  return (
    <Box
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...(gap !== undefined && { gap: `var(--space-${gap})` }),
        ...(align !== undefined && { alignItems: alignMap[align] }),
        ...(justify !== undefined && { justifyContent: justifyMap[justify] }),
        ...style,
      }}
      {...rest}
    />
  );
}) as (props: StackProps & { ref?: Ref<Element> }) => React.ReactElement | null;

(Stack as any).displayName = 'Stack';
