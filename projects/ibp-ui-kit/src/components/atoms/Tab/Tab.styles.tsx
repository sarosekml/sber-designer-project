import { HorizontalPosition, MediumSizeType, Orientation } from '@/types';
import { Sx } from '@/utils';

import { fontVariants, paddingBottom } from './Tab.const';

export const getTabStyles =
  (size: MediumSizeType, orientation: Orientation, textAlign: HorizontalPosition, hasIconValue: boolean): Sx =>
  (theme) => ({
    textTransform: 'none',
    alignItems: 'baseline',
    minWidth: 'fit-content',
    maxWidth: '100%',
    color: theme.palette.Text.TextSecondary,
    padding: orientation === 'horizontal' ? theme.spacing(3) : theme.spacing(3, 4, 3, 6),
    paddingBottom: paddingBottom[size],
    minHeight: 'auto',
    textAlign,
    ...(theme?.typography[fontVariants[size]] ?? {}),
    ...(hasIconValue
      ? {
          display: 'grid !important',
          gridTemplateColumns: 'auto max-content',
        }
      : {}),
    '&:hover': {
      color: theme.palette.Text.TextSecondary,
      backgroundColor: theme.palette.Primary.PrimaryBG,
    },
    '&.Mui-selected': {
      color: theme.palette.Text.TextPrimary,
    },
    '&:active': {
      backgroundColor: theme.palette.Primary.PrimaryBGLight,
    },
    '&.Mui-disabled': {
      color: theme.palette.Text.TextInactive,
    },
  });
