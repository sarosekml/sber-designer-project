import { breakpoints } from '@/styles/theme/breakpoints';
import { Sx } from '@/utils';

export const textSx: Sx = (theme) => {
  const { BodyMExtensive, BodySReg } = theme.typography;
  return {
    paddingRight: theme.spacing(8),
    color: theme.palette.Text.TextInactive,
    [theme.breakpoints.up(breakpoints.xs)]: {
      ...BodySReg,
    },
    [theme.breakpoints.up(breakpoints.sm)]: {
      ...BodyMExtensive,
    },
  };
};
