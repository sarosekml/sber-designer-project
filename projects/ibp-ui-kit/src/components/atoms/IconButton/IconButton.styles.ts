import { useMemo } from 'react';

import { mergeSx, Sx } from '@/utils';

import { getHoverSize, getIconSize } from './IconButton.const';
import { IconButtonStyleProps } from './IconButton.types';
import { getIconButtonColors } from './IconButton.utils';

export const getIconButtonStyles =
  ({ size = 'md', color, disabled }: IconButtonStyleProps): Sx =>
  (theme) => {
    const {
      Disabled: { Disabled },
    } = theme.palette;

    const { alertHoverColors, alertRippleColors } = getIconButtonColors(theme);

    const hoverSizeValue = getHoverSize(theme)[size];
    const fontSize = getIconSize(theme)[size];

    return {
      padding: 0,
      '&:hover': {
        background: 'none',
        '& .IconButton_icon__controller': {
          color: color && alertHoverColors[color] ? alertHoverColors[color] : theme.palette.Tertiary.TertiaryDark,
        },
      },
      '& .IconButton_icon__controller': {
        fontSize,
        color: disabled ? Disabled : color,
      },
      '& span.dmb-uikit-MuiTouchRipple-root': {
        color: color && alertRippleColors[color] ? alertRippleColors[color] : color,
        width: hoverSizeValue,
        height: hoverSizeValue,
        top: 'auto',
        right: 'auto',
        bottom: 'auto',
        left: 'auto',
      },
    };
  };

export const useIconButtonStyles = ({ sx, size, color, disabled }: IconButtonStyleProps & { sx?: Sx }): Sx =>
  useMemo(
    () =>
      mergeSx(
        getIconButtonStyles({
          size,
          disabled,
          color,
        }),
        sx,
      ),
    [size, disabled, color, sx],
  );
