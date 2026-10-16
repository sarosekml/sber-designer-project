import { Sx } from '@/utils';

import { TextStyledProps } from './Text.types';

export const getTextStyles =
  (props: TextStyledProps): Sx =>
  (theme) => ({
    display: props.span ? 'inline-block' : 'block',
    ...(props.cancelSelect && { userSelect: 'none' }),
    marginBottom: props.gutterBottom ? '1em' : 0,
    marginRight: props.gutterRight ? '1em' : 0,
    marginLeft: props.gutterLeft ? '1em' : 0,
    marginTop: props.gutterTop ? '1em' : 0,
    textAlign: props.align ?? 'left',

    /** @todo the prop type is optional (typography[props.type]). The typescript  takes it for undefined*/
    ...((props.type && theme?.typography?.[props?.type]) ?? {}),
    ...(props.color && { color: props.color }),
  });
