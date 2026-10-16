import { MediumSizeType } from '@/types';
import { Sx } from '@/utils';

export const getStyles =
  (lineClamp?: number, size?: MediumSizeType, whiteSpace: React.CSSProperties['whiteSpace'] = 'normal'): Sx =>
  (theme) => ({
    display: '-webkit-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lineClamp,
    whiteSpace: whiteSpace,
    wordWrap: 'break-word',

    ...(size === 'lg' && {
      ...theme.typography.BodyLReg,
    }),
    ...(size === 'md' && {
      ...theme.typography.BodyMReg,
    }),
    ...(size === 'sm' && {
      ...theme.typography.BodySReg,
    }),
  });
