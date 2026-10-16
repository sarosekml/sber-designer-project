import { Sx } from '@/utils';

import { StylesProps } from './DialogActions.types';

export const getStyles =
  ({ justify }: StylesProps): Sx =>
  (theme) => ({
    borderTop: `1px solid ${theme.palette.Border.BorderPrimary}`,
    justifyContent: justify,
    p: 4,
  });
