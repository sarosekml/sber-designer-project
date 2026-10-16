/* eslint-disable sort-keys-fix/sort-keys-fix */
import { GridSizes } from '@/types/common.types';

/**
 * @example gridSizes(xs, sm, md, lg, xl)
 * @example gridSizes(12) --> { xs: 12, sm: 12, md: 12, lg: 12, xl: 12 }
 * @example gridSizes(12, 5) --> { xs: 12, sm: 12, md: 5, lg: 5, xl: 5 }
 * @example gridSizes(3, 2, 1) --> { xs: 3, sm: 2, md: 1, lg: 1, xl: 1 }
 * @example gridSizes(4, 3, 2, 1) --> { xs: 4, sm: 3, md: 2, lg: 1, xl: 1 }
 * @example gridSizes(12, 10, 8, 3, 2) --> { xs: 12, sm: 10, md: 8, lg: 3, xl: 2 }
 *
 * xs extra-small: 0px
 * sm small: 600px
 * md medium: 960px
 * lg large: 1280px
 * xl extra-large: 1920px
 */
export const gridSizes = (xs: number, sm?: number, md?: number, lg?: number, xl?: number): GridSizes => {
  if (!sm) return { lg: xs, md: xs, sm: xs, xl: xs, xs };
  if (!md) return { lg: sm, md: sm, sm: xs, xl: sm, xs };
  return {
    xl: xl ?? lg ?? md ?? sm ?? xs,
    lg: lg ?? md ?? sm ?? xs,
    md: md ?? sm ?? xs,
    sm: sm ?? xs,
    xs,
  };
};
