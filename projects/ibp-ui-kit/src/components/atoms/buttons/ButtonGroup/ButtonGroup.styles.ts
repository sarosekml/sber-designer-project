import type { Theme } from '@mui/material';

import { ButtonColors, ButtonType } from '@/components/atoms/buttons/Button';
import { getOutlinedButtonColorScheme } from '@/components/atoms/buttons/Button/Button.utils';
import { Sx } from '@/utils';

import { ButtonGroupOrientation } from './ButtonGroup.types';

export const getContainerStyles =
  (type: ButtonType, color: ButtonColors, orientation: ButtonGroupOrientation): Sx =>
  (theme) => {
    let buttonStyles = {};

    if (type === 'transparent') {
      buttonStyles = getButtonTransparentStyles();
    }

    if (type === 'accent') {
      buttonStyles = getButtonAccentStyles(orientation, theme);
    }

    if (type === 'outlined') {
      buttonStyles = getButtonOutlinedStyles(color, orientation, theme);
    }

    return {
      'button.dmb-uikit-MuiButtonGroup-grouped:not(:first-of-type)': {
        borderLeftColor: type === 'outlined' && orientation === 'horizontal' ? 'transparent' : undefined,
        borderTopColor: type === 'outlined' && orientation === 'vertical' ? 'transparent' : undefined,
        ...buttonStyles,
      },
      'button.dmb-uikit-MuiButtonGroup-grouped:first-of-type': {
        ...buttonStyles,
      },
      'button.dmb-uikit-MuiButtonGroup-grouped': { minWidth: 'auto' },
    };
  };

export const getButtonAccentStyles = (orientation: ButtonGroupOrientation, theme: Theme) => ({
  borderLeftColor: orientation === 'horizontal' ? `${theme.palette.Primary.PrimaryLight}` : undefined,
  borderTopColor: orientation === 'vertical' ? `${theme.palette.Primary.PrimaryLight}` : undefined,
  '&:hover': {
    borderLeftColor: orientation === 'horizontal' ? `${theme.palette.Primary.PrimaryLight}` : undefined,
    borderTopColor: orientation === 'vertical' ? `${theme.palette.Primary.PrimaryLight}` : undefined,
  },
  '&:active': {
    borderColor: theme.palette.Primary.PrimaryLight,
  },
  '&:disabled': {},
});

export const getButtonOutlinedStyles = (color: ButtonColors, orientation: ButtonGroupOrientation, theme: Theme) => {
  const { default: defaultColors, active, hover } = getOutlinedButtonColorScheme(color, theme);
  return {
    borderRightColor: orientation === 'horizontal' ? `${defaultColors.borderColor}` : undefined,
    borderBottomColor: orientation === 'vertical' ? `${defaultColors.borderColor}` : undefined,
    '&:hover': {
      borderColor: hover.borderColor,
    },
    '&:active': {
      borderColor: active.borderColor,
    },
    '&:disabled, &:disabled:hover': {
      borderColor: theme.palette.Disabled.Disabled,
    },
  };
};

export const getButtonTransparentStyles = () => {
  return {
    borderColor: 'transparent',

    '&:hover': {
      borderColor: 'transparent',
    },
    '&:active': {
      borderColor: 'transparent',
    },
    '&:disabled, &:disabled:hover': {
      borderColor: 'transparent',
    },
  };
};
