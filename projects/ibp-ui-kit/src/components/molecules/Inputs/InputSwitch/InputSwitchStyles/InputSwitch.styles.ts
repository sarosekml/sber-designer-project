import { MediumSizeType } from '@/types/common.types';
import { cssImportant,Sx } from '@/utils';

import { InputSwitchStyleType } from '../InputSwitch.types';

import {
  inputSwitchCircleSize,
  inputSwitchFontLineHeight,
  inputSwitchFontSize,
  inputSwitchHeight,
  inputSwitchHelperTextPadding,
  inputSwitchLabelPadding,
  inputSwitchPadding,
  inputSwitchThumbTransformTranslateX,
  inputSwitchTrackHeight,
  inputSwitchTrackWidth,
} from './InputSwitch.const';

const getSwitchCircleSize = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchCircleSize[size]) : theme.spacing(inputSwitchCircleSize.md);

const getSwitchTrackWidth = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchTrackWidth[size]) : theme.spacing(inputSwitchTrackWidth.md);

const getSwitchTrackHeight = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchTrackHeight[size]) : theme.spacing(inputSwitchTrackHeight.md);

const getSwitchPadding = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchPadding[size]) : theme.spacing(inputSwitchPadding.md);

const getSwitchHeight = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchHeight[size]) : theme.spacing(inputSwitchHeight.md);

const getSwitchThumbTransformTranslateX = (size?: MediumSizeType) => (theme) =>
  size
    ? theme.spacing(inputSwitchThumbTransformTranslateX[size])
    : theme.spacing(inputSwitchThumbTransformTranslateX.md);

const getSwitchFontSize = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchFontSize[size]) : theme.spacing(inputSwitchFontSize.md);

const getSwitchFontLineHeight = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchFontLineHeight[size]) : theme.spacing(inputSwitchFontLineHeight.md);

const getSwitchLabelPadding = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchLabelPadding[size]) : theme.spacing(inputSwitchLabelPadding.md);

const getThumbColor =
  ({ disabled, checked, viewType }: InputSwitchStyleType) =>
  (theme) => {
    if ((disabled || viewType !== 'edit') && !checked) return theme.palette.Disabled.DisabledBorder;
    if ((disabled || viewType !== 'edit') && checked) return theme.palette.Disabled.Disabled;
    return checked ? theme.palette.Primary.Primary : theme.palette.BG.BGPopup;
  };

const getTrackColor =
  ({ disabled, checked, viewType }: InputSwitchStyleType) =>
  (theme) => {
    if ((disabled || viewType !== 'edit') && !checked) return theme.palette.Disabled.DisabledBorder;
    if ((disabled || viewType !== 'edit') && checked) return theme.palette.Tertiary.Tertiary;
    return checked ? theme.palette.Secondary.Secondary : theme.palette.Disabled.Disabled;
  };

const getHelperTextPaddingBySize = (size?: MediumSizeType) => (theme) =>
  size ? theme.spacing(inputSwitchHelperTextPadding[size]) : theme.spacing(inputSwitchHelperTextPadding.md);

/** ------------- Styles ------------- */

export const inputSwitchContainerStyles: Sx = {
  width: '100%',
};

export const inputSwitchLabelStyles =
  ({ disabled, viewType, size }: InputSwitchStyleType): Sx =>
  (theme) => ({
    pointerEvents: viewType !== 'edit' || disabled ? 'none' : 'auto',
    color: disabled || viewType !== 'edit' ? theme.palette.Text.TextInactive : theme.palette.Text.TextBlack,
    margin: 0,
    '& span.dmb-uikit-MuiTypography-root': {
      pl: getSwitchLabelPadding(size)(theme),
      fontSize: getSwitchFontSize(size)(theme),
      lineHeight: getSwitchFontLineHeight(size)(theme),
    },
  });

export const inputSwitchStyles =
  ({ disabled, viewType, checked, size }: InputSwitchStyleType): Sx =>
  (theme) => ({
    width: 'auto',
    height: getSwitchHeight(size)(theme),
    padding: getSwitchPadding(size)(theme),
    /** Reset input position */
    '& span.dmb-uikit-MuiButtonBase-root': {
      padding: size === 'lg' ? theme.spacing(2) : theme.spacing(1),
      transform: checked ? `translateX(${getSwitchThumbTransformTranslateX(size)(theme)})` : 'none',
      '&:hover': {
        backgroundColor: theme.palette.Primary.PrimaryBG,
      },
    },
    '& span > span.dmb-uikit-MuiSwitch-thumb': {
      width: getSwitchCircleSize(size)(theme),
      height: getSwitchCircleSize(size)(theme),
      backgroundColor: cssImportant(getThumbColor({ disabled, viewType, checked })(theme)),
      opacity: cssImportant(1),
      boxShadow: `0px 1px 2px ${theme.palette.Product.PGrey}30, 0px 1px 3px 1px ${theme.palette.Product.PGrey}15`,
    },
    '& span.dmb-uikit-MuiSwitch-track': {
      height: getSwitchTrackHeight(size)(theme),
      width: getSwitchTrackWidth(size)(theme),
      backgroundColor: cssImportant(getTrackColor({ disabled, viewType, checked })(theme)),
      opacity: cssImportant(1),
    },
  });

export const inputSwitchHelperTextStyles =
  (size?: MediumSizeType): Sx =>
  (theme) => ({
    pl: getHelperTextPaddingBySize(size)(theme),
  });
