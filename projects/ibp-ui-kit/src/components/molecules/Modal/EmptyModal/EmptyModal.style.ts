import { breakpoints } from '@/styles/theme/breakpoints';
import { Sx } from '@/utils';

import { DialogStyleProps } from './EmptyModal.types';

export const getPaperSx =
  ({ width, height }: DialogStyleProps): Sx =>
  (theme) => ({
    borderRadius: 2,
    [theme.breakpoints.up(breakpoints.md)]: {
      maxWidth: width,
      height: height ?? 'auto',
    },
  });
