import type { Theme } from '@mui/material';

import {
  BadgeColorScheme,
  BadgeColorTheme,
  BadgeColorThemeSx,
  BadgeStyleVariant,
  StyleVariants,
} from './DictionaryBadge.types';

export const isPlainTheme = (themeSx: BadgeColorThemeSx): themeSx is BadgeColorTheme => {
  return typeof themeSx !== 'function';
};

export const executeTheme = (themeSx: BadgeColorThemeSx = {}, theme: Theme) => {
  if (isPlainTheme(themeSx)) return themeSx;

  return themeSx(theme);
};

export const getBadgeColorScheme = (variant: BadgeStyleVariant, theme: Theme): BadgeColorScheme => {
  const {
    Tertiary: { Tertiary, TertiaryLight, TertiaryDark },
    Status: {
      StDisabledLight,
      StSystemMidLight,
      StSystemDark,
      StSystemLight,
      StDisabledDark,
      StSystemMid,
      StDisabledMid,
    },
    Text: { TextOnTertiary, TextBlack, TextInactive, TextOnDark },
    Disabled: { DisabledBG },
  } = theme.palette;

  const commonActiveStyles = {
    backgroundColor: TertiaryDark,
    borderColor: TextOnTertiary,
    color: TextOnDark,
  };

  const commonHoverActiveStyles = {
    backgroundColor: TextOnTertiary,
    borderColor: TextBlack,
    color: TextOnDark,
  };

  switch (variant) {
    case 'filled':
      return {
        base: {
          backgroundColor: TertiaryLight,
          borderColor: TertiaryLight,
          color: TextOnTertiary,
        },
        hover: {
          backgroundColor: Tertiary,
          borderColor: Tertiary,
          color: TextBlack,
        },
        disabled: {
          backgroundColor: DisabledBG,
          borderColor: DisabledBG,
          color: TextInactive,
        },
        active: {
          ...commonActiveStyles,
          borderColor: TertiaryDark,
        },
        activeHover: {
          ...commonHoverActiveStyles,
          borderColor: TextOnTertiary,
        },
      };
    case 'outlined':
      return {
        base: {
          backgroundColor: StSystemLight,
          borderColor: StSystemLight,
          color: StSystemDark,
        },
        hover: {
          backgroundColor: StSystemMidLight,
          borderColor: StSystemLight,
          color: StSystemDark,
        },
        disabled: {
          backgroundColor: StDisabledLight,
          borderColor: StDisabledLight,
          color: StDisabledDark,
        },
        active: commonActiveStyles,
        activeHover: commonHoverActiveStyles,
      };
    case 'transparent':
      return {
        base: {
          backgroundColor: 'transparent',
          borderColor: StSystemMid,
          color: StSystemDark,
        },
        hover: {
          backgroundColor: StSystemMidLight,
          borderColor: StSystemMid,
          color: StSystemDark,
        },
        disabled: {
          backgroundColor: 'transparent',
          borderColor: StDisabledMid,
          color: StDisabledDark,
        },
        active: commonActiveStyles,
        activeHover: commonHoverActiveStyles,
      };
  }
};

export const getBadgeSpacings: (hasPostfix: boolean) => StyleVariants<{ pr: number; pl: number; tb: number }> = (
  hasPostfix: boolean,
) => {
  if (hasPostfix) {
    return {
      edit: {
        lg: {
          pl: 4,
          pr: 3,
          tb: 2,
        },
        md: {
          pl: 3,
          pr: 2,
          tb: 1.5,
        },
        sm: {
          pl: 2,
          pr: 1.5,
          tb: 1,
        },
      },
      read: {
        lg: {
          pl: 2,
          pr: 1.5,
          tb: 0.5,
        },
        md: {
          pl: 2,
          pr: 1.5,
          tb: 0.5,
        },
        sm: {
          pl: 1.5,
          pr: 1,
          tb: 0,
        },
      },
    };
  } else {
    return {
      edit: {
        lg: {
          pl: 4,
          pr: 4,
          tb: 2,
        },
        md: {
          pl: 3,
          pr: 3,
          tb: 1.5,
        },
        sm: {
          pl: 2,
          pr: 2,
          tb: 1,
        },
      },
      read: {
        lg: {
          pl: 2,
          pr: 2,
          tb: 0.5,
        },
        md: {
          pl: 2,
          pr: 2,
          tb: 0.5,
        },
        sm: {
          pl: 1.5,
          pr: 1.5,
          tb: 0,
        },
      },
    };
  }
};
