import { CSSProperties } from 'react';
import { Theme } from '@mui/material';

import { ButtonSize } from '@/types';

import { ButtonColors, ContentVariant, OutlineButtonColorScheme } from './Button.types';

export const getButtonHeight = (theme: Theme, size: ButtonSize) => {
  const variants: Record<ButtonSize, string> = {
    lg: theme.spacing(12),
    md: theme.spacing(10),
    sm: theme.spacing(8),
    xs: theme.spacing(6),
  };
  return variants[size];
};

export const getContentVariant = (
  hasText: boolean,
  hasStartIcon: boolean,
  hasEndIcon: boolean,
  hasLoader: boolean,
): ContentVariant => {
  if (!hasText && (hasStartIcon || hasEndIcon || hasLoader)) return 'onlyIcon';
  if (hasStartIcon && hasEndIcon) return 'textAndBothIcons';
  if (hasStartIcon) return 'textAndStartIcon';
  if (hasEndIcon && hasLoader) return 'textAndEndIcon';
  if (hasLoader) return 'textAndLoader';
  return 'onlyText';
};

export const getPaddingByContent = (theme: Theme, size: ButtonSize, content: ContentVariant) => {
  const paddingVariants: Record<ButtonSize, Record<ContentVariant, CSSProperties['padding']>> = {
    lg: {
      onlyText: theme.spacing(2, 5),
      textAndStartIcon: theme.spacing(2, 5, 2, 4),
      textAndLoader: theme.spacing(2, 5, 2, 4),
      textAndEndIcon: theme.spacing(2, 4, 2, 5),
      textAndBothIcons: theme.spacing(2, 4),
      onlyIcon: theme.spacing(3),
    },
    md: {
      onlyText: theme.spacing(2, 4),
      textAndStartIcon: theme.spacing(2, 4, 2, 3),
      textAndLoader: theme.spacing(2, 4, 2, 3),
      textAndEndIcon: theme.spacing(2, 3, 2, 4),
      textAndBothIcons: theme.spacing(2, 3),
      onlyIcon: theme.spacing(2.5),
    },
    sm: {
      onlyText: theme.spacing(1.5, 3),
      textAndStartIcon: theme.spacing(1.5, 3, 1.5, 2.5),
      textAndLoader: theme.spacing(1.5, 3, 1.5, 2.5),
      textAndEndIcon: theme.spacing(1.5, 2.5, 1.5, 3),
      textAndBothIcons: theme.spacing(1.5, 2.5),
      onlyIcon: theme.spacing(2),
    },
    xs: {
      onlyText: theme.spacing(0.5, 2),
      textAndStartIcon: theme.spacing(1, 2, 1, 1.5),
      textAndLoader: theme.spacing(1, 2, 1, 1.5),
      textAndEndIcon: theme.spacing(1, 1.5, 1, 2),
      textAndBothIcons: theme.spacing(1, 1.5),
      onlyIcon: theme.spacing(1),
    },
  };
  return paddingVariants[size][content];
};

type ButtonStateColorScheme = Record<'default' | 'hover' | 'active', OutlineButtonColorScheme>;
const getOutlinedButtonAccentColorScheme = (accentColor: string, theme: Theme): ButtonStateColorScheme => ({
  default: {
    borderColor: accentColor,
    color: accentColor,
  },
  hover: {
    backgroundColor: theme.palette.Primary.PrimaryBGSemiTransparent,
  },
  active: {
    backgroundColor: accentColor,
    color: theme.palette.Text.TextOnDark,
  },
});
export const getOutlinedButtonColorScheme = (color: ButtonColors, theme: Theme): ButtonStateColorScheme => {
  switch (color) {
    case 'info':
      return getOutlinedButtonAccentColorScheme(theme.palette.Info.Info, theme);
    case 'success':
      return getOutlinedButtonAccentColorScheme(theme.palette.Success.Success, theme);
    case 'warning':
      return getOutlinedButtonAccentColorScheme(theme.palette.Warning.Warning, theme);
    case 'error':
      return getOutlinedButtonAccentColorScheme(theme.palette.Error.Error, theme);
    case 'default':
      return {
        default: {
          borderColor: theme.palette.Secondary.Secondary,
          color: theme.palette.Primary.Primary,
        },
        hover: {
          backgroundColor: theme.palette.Primary.PrimaryBG,
          borderColor: theme.palette.Secondary.SecondaryDark,
          color: theme.palette.Primary.PrimaryDark,
        },
        active: {
          backgroundColor: 'transparent',
          borderColor: theme.palette.Secondary.SecondaryLight,
          color: theme.palette.Primary.PrimaryLight,
        },
      };
    case 'primary':
      return {
        default: {
          borderColor: theme.palette.Primary.Primary,
          color: theme.palette.Primary.Primary,
        },
        hover: {
          backgroundColor: theme.palette.Secondary.SecondaryBG,
          borderColor: theme.palette.Primary.PrimaryDark,
          color: theme.palette.Primary.PrimaryDark,
        },
        active: {
          backgroundColor: 'transparent',
          borderColor: theme.palette.Primary.PrimaryLight,
          color: theme.palette.Primary.PrimaryLight,
        },
      };
    case 'secondary':
      return {
        default: {
          borderColor: theme.palette.Secondary.Secondary,
          color: theme.palette.Secondary.Secondary,
        },
        hover: {
          backgroundColor: theme.palette.Secondary.SecondaryBG,
          borderColor: theme.palette.Secondary.SecondaryDark,
          color: theme.palette.Secondary.SecondaryDark,
        },
        active: {
          backgroundColor: 'transparent',
          borderColor: theme.palette.Secondary.SecondaryLight,
          color: theme.palette.Secondary.SecondaryLight,
        },
      };
  }
};
