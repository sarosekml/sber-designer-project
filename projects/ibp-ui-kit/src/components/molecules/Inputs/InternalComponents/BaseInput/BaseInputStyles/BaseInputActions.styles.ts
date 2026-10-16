import { TextTypes } from '@/styles/theme/typography';
import { MediumSizeType } from '@/types/common.types';
import { Sx } from '@/utils';

import { BaseInputIconColorStyleType } from './BaseInput.styles.types';

export const fontVariants: Record<MediumSizeType, TextTypes> = {
  lg: 'BodyLReg',
  md: 'BodyMReg',
  sm: 'BodySReg',
};

export const actionsIndentSizes: Record<MediumSizeType, number> = {
  lg: 2.5,
  md: 2,
  sm: 1.5,
};

export const prefixPostfixStyles =
  (size: MediumSizeType): Sx =>
  (theme) => ({
    color: theme.palette.Text.TextInactive,
    fontSize: theme.typography[fontVariants[size]]?.fontSize,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

export const iconHoverStyles =
  ({ disabled }: BaseInputIconColorStyleType & { size?: MediumSizeType; isLastItem?: boolean }): Sx =>
  (theme) => ({
    '& .dmb-uikit-MuiSvgIcon-root': {
      '&:hover': {
        color: disabled ? theme.palette.Disabled.Disabled : theme.palette.Secondary.SecondaryDark,
      },
      '&:active': {
        color: disabled ? theme.palette.Disabled.Disabled : theme.palette.Secondary.SecondaryLight,
      },
    },
  });
