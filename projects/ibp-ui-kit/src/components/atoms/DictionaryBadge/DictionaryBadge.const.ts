import { CSSProperties } from 'react';

import { theme } from '@/styles';
import { MediumSizeType } from '@/types/common.types';

import { BadgeColorThemeSx, StyleVariants } from './DictionaryBadge.types';

export const heights: StyleVariants<string> = {
  edit: {
    lg: theme.spacing(10),
    md: theme.spacing(8),
    sm: theme.spacing(6),
  },
  read: {
    lg: theme.spacing(6),
    md: theme.spacing(5),
    sm: theme.spacing(4),
  },
};

export const fonts: StyleVariants<string> = {
  edit: {
    lg: 'BodyLReg',
    md: 'BodyMReg',
    sm: 'BodySReg',
  },
  read: {
    lg: 'BodyMReg',
    md: 'BodySReg',
    sm: 'BodyXSReg',
  },
};

export const iconSizes: StyleVariants<string> = {
  edit: {
    lg: theme.spacing(6),
    md: theme.spacing(5),
    sm: theme.spacing(4),
  },
  read: {
    lg: theme.spacing(5),
    md: theme.spacing(4),
    sm: theme.spacing(3),
  },
};

export const borderRadius: Record<MediumSizeType, number> = {
  lg: 2,
  md: 2,
  sm: 1,
};

export const iconMargins: StyleVariants<number> = {
  edit: {
    lg: 2,
    md: 1.5,
    sm: 1,
  },
  read: {
    lg: 1.5,
    md: 1,
    sm: 0.5,
  },
};

export const textBadgeSizes: StyleVariants<string> = {
  edit: {
    lg: theme.spacing(7),
    md: theme.spacing(5),
    sm: theme.spacing(4),
  },
  read: {
    lg: theme.spacing(5),
    md: theme.spacing(4),
    sm: theme.spacing(3.5),
  },
};

export const textBadgeTextSize: StyleVariants<CSSProperties> = {
  edit: {
    lg: theme.typography.BodyMReg,
    md: theme.typography.BodySReg,
    sm: theme.typography.BodyXSReg,
  },
  read: {
    lg: theme.typography.BodySReg,
    md: theme.typography.BodyXSReg,
    sm: theme.typography.BodyXSReg,
  },
};

/**
 * @deprecated 'filled' is deprecated, please use 'outlined' instead
 */
export const dictionaryBadgeErrorColorThemeSx: BadgeColorThemeSx = (theme) => ({
  backgroundColor: theme.palette.Error.ErrorBG,
  borderColor: theme.palette.Error.ErrorBG,
  textColor: theme.palette.Text.TextBlack,
  backgroundColorHover: theme.palette.Error.ErrorBGDark,
  borderColorHover: theme.palette.Error.ErrorBGDark,
});

export const dictionaryBadgeOutlinedErrorColorThemeSx: BadgeColorThemeSx = (theme) => ({
  backgroundColor: theme.palette.Error.ErrorBG,
  borderColor: theme.palette.Error.ErrorBGDark,
  textColor: theme.palette.Text.TextBlack,
  backgroundColorHover: theme.palette.Error.ErrorBGDark,
  borderColorHover: theme.palette.Error.Error,
});

export const dictionaryBadgeTransparentErrorColorThemeSx: BadgeColorThemeSx = (theme) => ({
  backgroundColor: 'transparent',
  borderColor: theme.palette.Error.ErrorBGDark,
  textColor: theme.palette.Text.TextBlack,
  backgroundColorHover: 'transparent',
  borderColorHover: theme.palette.Error.Error,
});
