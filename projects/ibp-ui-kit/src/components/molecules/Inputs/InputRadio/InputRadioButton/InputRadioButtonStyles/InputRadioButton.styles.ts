import { InputViewType } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInput.types';
import { MediumSizeType } from '@/types/common.types';
import { cssImportant, Sx, Theme } from '@/utils';

import { InputRadioButtonStyleType } from '../InputRadioButton.types';

import { fontVariants, helperTextPadding, iconSize, paddingRadioButton } from './InputRadioButton.const';

const getCursor = (viewType: InputViewType, disabled?: boolean) =>
  viewType !== 'edit' || disabled ? 'default' : 'pointer';

const getColor = (viewType: InputViewType, disabled?: boolean) => (theme: Theme) => {
  if (disabled) return theme.palette.Disabled.DisabledBorder;
  if (viewType !== 'edit') return theme.palette.Border.BorderPrimary;
  return theme.palette.Border.BorderDark;
};

const getCheckedColor = (viewType: InputViewType, disabled?: boolean) => (theme: Theme) => {
  if (disabled) return theme.palette.Disabled.DisabledBorder;
  if (viewType !== 'edit') return theme.palette.Border.BorderPrimary;
  return theme.palette.Primary.Primary;
};

const getHoverColor = (viewType: InputViewType, disabled?: boolean) => (theme: Theme) => {
  if (disabled) return theme.palette.Disabled.DisabledBorder;
  if (viewType !== 'edit') return theme.palette.Border.BorderPrimary;
  return theme.palette.Primary.PrimaryDark;
};

const getActiveColor = (viewType: InputViewType, disabled?: boolean) => (theme: Theme) => {
  if (disabled) return theme.palette.Disabled.DisabledBorder;
  if (viewType !== 'edit') return theme.palette.Border.BorderPrimary;
  return theme.palette.Primary.PrimaryLight;
};

const getLabelColor = (disabled?: boolean) => (theme: Theme) =>
  disabled ? theme.palette.Text.TextInactive : theme.palette.Text.TextPrimary;

export const getInputRadioButtonStyles =
  ({ size, viewType, disabled }: InputRadioButtonStyleType): Sx =>
  (theme: Theme) => ({
    pb: 0,
    pt: 0,
    pr: paddingRadioButton[size],
    pointerEvents: viewType !== 'edit' ? 'none' : 'all',
    cursor: getCursor(viewType, disabled),
    color: cssImportant(getColor(viewType, disabled)(theme)),
    '& svg': {
      fontSize: theme.spacing(iconSize[size]),
    },
    '&:hover': {
      color: getHoverColor(viewType, disabled)(theme),
      background: 'transparent',
    },
    '&:active': {
      color: getActiveColor(viewType, disabled)(theme),
    },
    '&.Mui-checked': {
      color: getCheckedColor(viewType, disabled)(theme),
      '&:hover': {
        color: getHoverColor(viewType, disabled)(theme),
      },
      '&:active': {
        color: getActiveColor(viewType, disabled)(theme),
      },
    },
    '& .dmb-uikit-MuiTouchRipple-root': {
      display: 'none',
    },
  });

export const getInputRadioButtonLabelStyles =
  (size: MediumSizeType, viewType: InputViewType, disabled?: boolean): Sx =>
  (theme: Theme) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'start',
    pointerEvents: viewType !== 'edit' ? 'none' : 'all',
    '& .dmb-uikit-MuiTypography-root': {
      color: cssImportant(getLabelColor(disabled)(theme)),
      typography: fontVariants[size],
      wordBreak: 'break-all',
      whiteSpace: 'pre-wrap',
    },
  });

export const getInputRadioButtonHelpertextStyles =
  (size: MediumSizeType): Sx =>
  (_: Theme) => ({
    paddingLeft: helperTextPadding[size],
  });
