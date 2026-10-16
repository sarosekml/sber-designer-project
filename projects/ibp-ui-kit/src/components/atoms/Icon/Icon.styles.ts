import { Theme } from '@mui/material';

import { InheritableSizeType } from '@/types';
import { mergeSx, Sx } from '@/utils';

import { IconColors } from './Icon.types';

const getIconSize = (theme: Theme): Record<InheritableSizeType, string> => ({
  inherit: 'inherit',
  lg: theme.spacing(6),
  md: theme.spacing(5),
  sm: theme.spacing(4),
});

export const getIconColors = (theme: Theme): Record<IconColors, string> => ({
  inherit: 'inherit',
  action: theme.palette.Primary.PrimaryLight,
  disabled: theme.palette.Disabled.Disabled,
  primary: theme.palette.Primary.Primary,
  secondary: theme.palette.Secondary.Secondary,
  error: theme.palette.Error.Error,
  info: theme.palette.Info.InfoBlue,
  success: theme.palette.Success.Success,
  warning: theme.palette.Warning.Warning,
});

export const countIconStyles =
  (size: InheritableSizeType, color?: string): Sx =>
  (theme) => {
    const iconSize = getIconSize(theme)[size];
    const baseColors = getIconColors(theme);
    let finalColor = theme.palette.Primary.Primary;

    if (color) {
      if (baseColors?.[color]) {
        finalColor = baseColors[color];
      } else {
        finalColor = color;
      }
    }

    return {
      display: 'flex',
      color: finalColor,
      width: iconSize,
      height: iconSize,
      fontSize: iconSize,
      '& svg': {
        fontSize: iconSize,
        width: iconSize,
        height: iconSize,
      },
    };
  };

export const getIconStyles = (size: InheritableSizeType, color?: string, sx?: Sx) =>
  mergeSx(countIconStyles(size, color), sx);
