import { Theme } from '@mui/system';

import { MediumSizeType } from '@/types/common.types';
import { cssImportant, Sx } from '@/utils';

import { InputValidationType } from '../BaseInput.types';

import {
  BaseInputBorderStyleType,
  BaseInputIconColorStyleType,
  BaseInputReadAndPresentStyleType,
  BaseInputStyleType,
} from './BaseInput.styles.types';

export const baseInputIconColorStyles =
  ({ disabled }: BaseInputIconColorStyleType): Sx =>
  (theme) => ({
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? cssImportant(theme.palette.Disabled.Disabled) : cssImportant(theme.palette.Secondary.Secondary),
    pointerEvents: disabled ? 'none' : 'auto',
  });

export const baseInputActionsContainerStyles: Sx = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
};

export const getFontBySize = (size?: MediumSizeType) => (theme) => {
  const fontSizes: Record<MediumSizeType, string> = {
    sm: theme.typography.BodySReg.fontSize,
    md: theme.typography.BodyMReg.fontSize,
    lg: theme.typography.BodyLReg.fontSize,
  };
  return size ? fontSizes[size] : fontSizes.md;
};

export const getPaddingBySize = (size?: MediumSizeType) => (theme) => {
  const paddings: Record<MediumSizeType, string> = {
    sm: theme.spacing(2),
    md: theme.spacing(2.5),
    lg: theme.spacing(3),
  };
  return size ? paddings[size] : paddings.md;
};

export const getHeightBySize = (size?: MediumSizeType) => (theme) => {
  const fontLineHeights: Record<MediumSizeType, string> = {
    sm: theme.spacing(4),
    md: theme.spacing(5),
    lg: theme.spacing(6),
  };
  return size ? fontLineHeights[size] : fontLineHeights.md;
};

const getBaseBorder = (theme: Theme) => `1px solid ${theme.palette.Border.BorderPrimary}`;
const getDisabledBorder = (theme: Theme) => `1px solid ${theme.palette.Disabled.DisabledBorder}`;
const getAccentBorder = (thickness: number, theme: Theme) => `${thickness}px solid ${theme.palette.Primary.Primary}`;
const getValidationBorder = (thickness: number, validationType: InputValidationType, theme: Theme) =>
  `${thickness}px solid ${validationType === 'warning' ? theme.palette.Warning.Warning : theme.palette.Error.Error}`;
const coloredBackgroundBorder = '1px solid transparent';

const getOutline = ({ focused, validationOptions, theme, disabled }: BaseInputBorderStyleType) => {
  if (disabled) return 'none';
  const validationBorder = getValidationBorder(1, validationOptions ? validationOptions.type : 'error', theme);
  const accentBorder = getAccentBorder(1, theme);
  return focused && validationOptions ? validationBorder : focused ? accentBorder : 'none';
};

const getBaseInputBorderHover = ({
  disabled,
  validationOptions,
  focused,
  theme,
  isColoredBg,
}: BaseInputBorderStyleType): Sx => {
  const outline = getOutline({ focused, validationOptions, theme, disabled });
  const border =
    isColoredBg && disabled
      ? coloredBackgroundBorder
      : disabled
      ? getDisabledBorder
      : validationOptions
      ? getValidationBorder(1, validationOptions.type, theme)
      : getAccentBorder(1, theme);
  return { border, outline };
};

const getBaseInputBorder = ({
  validationOptions,
  focused,
  theme,
  disabled,
  isColoredBg,
}: BaseInputBorderStyleType): Sx => {
  const outline = getOutline({ focused, validationOptions, theme, disabled });
  const border =
    disabled && isColoredBg
      ? coloredBackgroundBorder
      : disabled
      ? getDisabledBorder
      : validationOptions
      ? getValidationBorder(1, validationOptions.type, theme)
      : focused
      ? getAccentBorder(1, theme)
      : getBaseBorder;
  return { border, outline };
};

export const baseInputStyles =
  ({ size, disabled, focused, validationOptions, isColoredBg, textColor, multiline }: BaseInputStyleType): Sx =>
  (theme) => ({
    background: 'transparent',

    /** Basic input container styles */
    '& .dmb-uikit-MuiInputBase-root': {
      background: isColoredBg && disabled ? theme.palette.Disabled.DisabledBGSemiTransparent : theme.palette.BG.BGPopup,
      '&:hover': getBaseInputBorderHover({ disabled, focused, validationOptions, theme, isColoredBg }),
      ...getBaseInputBorder({ focused, validationOptions, theme, disabled, isColoredBg }),
      padding: getPaddingBySize(size)(theme),
      alignItems: 'flex-start',
      overflow: 'hidden',

      '& .dmb-uikit-MuiInputAdornment-root': {
        height: 'initial',
        maxHeight: getHeightBySize(size)(theme),
      },
      /** Remove conflicted by styles fieldset to work with Input customization */
      '& fieldset': {
        display: 'none',
      },
      /** Reset for native input styling and customize by design system */
      '& .dmb-uikit-MuiInputBase-input': {
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        alignSelf: 'center',
        height: getHeightBySize(size)(theme),
        fontSize: getFontBySize(size)(theme),
        lineHeight: getHeightBySize(size)(theme),
        color: textColor ? textColor : theme.palette.Text.TextPrimary,
        textOverflow: 'ellipsis',
      },
    },

    /** Reset useless styles for input label */
    '& label.dmb-uikit-MuiFormLabel-root': {
      position: 'relative',
      transform: 'none',
      boxSizing: 'unset',
    },

    /** Reset useless styles for helper text */
    '& .dmb-uikit-MuiFormHelperText-root': {
      m: 0,
    },
  });

export const baseInputReadAndPresentStyles: BaseInputReadAndPresentStyleType = {
  container: {
    '&.BaseInputRead_container': {
      width: '100%',
    },
  },

  valueReadContainer:
    (isValidation): Sx =>
    (theme) => ({
      display: 'flex',
      backgroundColor: isValidation ? theme.palette.Error.ErrorBG : 'transparent',
      borderRadius: theme.spacing(1),
      pr: theme.spacing(1),
      border: '1px solid transparent',
      '&:hover': {
        backgroundColor: isValidation ? theme.palette.Error.ErrorBGDark : 'transparent',
      },
      alignItems: 'center',
    }),

  valuePresentContainer:
    (isValidation, size): Sx =>
    (theme) => ({
      display: 'flex',
      border: isValidation
        ? `1px dashed ${theme.palette.Error.Error}`
        : `1px dashed ${theme.palette.Border.BorderPrimary}`,
      padding: getPaddingBySize(size)(theme),
      borderRadius: theme.spacing(1),
      alignItems: 'center',
    }),

  valueText:
    ({ size, multiline, rows, disabled, textColor }) =>
    (theme) => ({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: multiline ? 'normal' : 'nowrap',
      lineHeight: getHeightBySize(size)(theme),
      fontSize: getFontBySize(size)(theme),
      color: textColor ?? (disabled ? theme.palette.Text.TextInactive : theme.palette.Text.TextPrimary),
      minHeight: getHeightBySize(size)(theme),
      wordWrap: multiline ? 'break-word' : 'unset',
      display: multiline ? '-webkit-box' : 'block',
      WebkitLineClamp: multiline && rows ? rows : 'none',
      WebkitBoxOrient: 'vertical',
    }),
};
