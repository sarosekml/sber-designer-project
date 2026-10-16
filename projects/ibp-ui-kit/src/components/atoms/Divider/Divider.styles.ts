import { Sx } from '@/utils';

import { Color, StylesProps } from './Divider.types';

export const getDividerSx =
  ({ color = 'light' }: StylesProps): Sx =>
  (theme) => {
    const {
      Border: { BorderPrimary, BorderLight, BorderDark },
    } = theme.palette;

    const colors: Record<Color, string> = {
      primary: BorderPrimary,
      light: BorderLight,
      dark: BorderDark,
    };

    return {
      borderColor: colors[color],
    };
  };
