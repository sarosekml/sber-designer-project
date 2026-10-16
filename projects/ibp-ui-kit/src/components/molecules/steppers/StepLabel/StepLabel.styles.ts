import { Sx,SxProps } from '@/utils';

import { StylesProps } from './StepLabel.types';

const iconSizeSpacingValue = 5;
const containerPaddingSpacingValue = 0.5;
const iconPaddingSpacingValue = 2;
const helperTextPaddingLeftSpacingValue = iconSizeSpacingValue + containerPaddingSpacingValue + iconPaddingSpacingValue;

export const useStyles =
  ({ active, children, disabled, iconVisible, helperText, cursorPointer, stepperType }: StylesProps): Sx =>
  (theme) => {
    const labelContainerStyles: SxProps = {
      color: theme.palette.Text.TextPrimary,
      ...(disabled && {
        color: theme.palette.Text.TextInactive,
        cursor: 'default',
      }),

      ...(stepperType === 'arrowed' && {
        color: active ? theme.palette.Text.TextPrimary : theme.palette.Secondary.Secondary,

        ':hover': {
          color: theme.palette.Secondary.SecondaryDark,
        },

        '.dmb-uikit-MuiTypography-root': {
          py: 0.5,
          px: 2,
          borderRadius: 2,
          ':hover': {
            backgroundColor: theme.palette.Secondary.SecondaryBG,
          },
        },
      }),
      '.Mui-active': {
        color: 'unset',
      },
    };

    const labelStyles: SxProps = {
      lineHeight: theme.spacing(5),
    };

    const iconContainerStyles: SxProps = {
      alignSelf: 'center',
      pr: stepperType === 'arrowed' ? 0 : iconPaddingSpacingValue,
      ...(!children &&
        !helperText && {
          pr: 0,
        }),
    };

    return {
      height: 'min-content',
      padding: containerPaddingSpacingValue,
      ...(!iconVisible && {
        pl: 1,
      }),
      ...(active && {
        backgroundColor: stepperType === 'arrowed' ? 'inherit' : theme.palette.Tertiary.TertiaryLight,
        borderRadius: 3,
      }),
      ...(!children && {
        ...(!helperText && {
          pl: containerPaddingSpacingValue,
          width: 'fit-content',
        }),
      }),
      '&:hover': {
        cursor: cursorPointer ? 'pointer' : 'default',
      },
      '.dmb-uikit-MuiStepLabel-label': labelStyles,
      '.dmb-uikit-MuiStepLabel-labelContainer': labelContainerStyles,
      '.dmb-uikit-MuiStepLabel-iconContainer': iconContainerStyles,
    };
  };

export const useHelperStyles = ({ iconVisible }: StylesProps): Sx => {
  return {
    position: 'absolute',
    display: 'flex',
    pt: containerPaddingSpacingValue,
    pl: iconVisible ? helperTextPaddingLeftSpacingValue : 1,
  };
};

export const useIconStyles =
  ({ active, completed, disabled, stepperType }: StylesProps): Sx =>
  (theme) => {
    return {
      ...(stepperType === 'checkmark' && {
        ...(!completed && {
          color: active ? theme.palette.BG.BGTile : theme.palette.Text.TextSecondary,
        }),
        ...(disabled && {
          color: active && !completed ? theme.palette.BG.BGTile : theme.palette.Disabled.Disabled,
        }),
      }),
    };
  };
