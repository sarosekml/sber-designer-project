import { InputViewType } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInput.types';
import { MediumSizeType } from '@/types/common.types';
import { cssImportant, Sx, Theme } from '@/utils';

import { InputCheckboxStyleType } from '../InputCheckbox.types';

import {
  inputCheckboxHelperTextPaddings,
  inputCheckboxIconFontSizes,
  inputCheckboxLabelFontSizes,
  inputCheckboxLabelLineHeight,
  inputCheckboxLabelPaddings,
} from './InputCheckbox.const';

const getLabelPaddingBySize = (size: MediumSizeType) => (theme) => theme.spacing(inputCheckboxLabelPaddings[size]);

const getLabelFontBySize = (size: MediumSizeType) => (theme) => theme.spacing(inputCheckboxLabelFontSizes[size]);

const getLabelLineHeight = (size: MediumSizeType) => (theme) => theme.spacing(inputCheckboxLabelLineHeight[size]);

const getIconFontBySize = (size: MediumSizeType) => (theme) => theme.spacing(inputCheckboxIconFontSizes[size]);

const getHelperTextPaddingBySize = (size: MediumSizeType) => (theme) =>
  theme.spacing(inputCheckboxHelperTextPaddings[size]);

const countCheckboxColor =
  (viewType: InputViewType, disabled?: boolean, checked?: boolean, indeterminate?: boolean) => (theme: Theme) => {
    if (disabled) return theme.palette.Disabled.Disabled;
    if (viewType !== 'edit') return theme.palette.Border.BorderPrimary;
    if (checked || indeterminate) return theme.palette.Primary.Primary;
    return theme.palette.Border.BorderDark;
  };

const getCursor = (viewType: InputViewType, disabled?: boolean) =>
  viewType !== 'edit' || disabled ? 'default' : 'pointer';

const getHoverInputColor = (viewType: InputViewType) => (theme: Theme) =>
  viewType !== 'edit' ? theme.palette.Border.BorderPrimary : theme.palette.Primary.PrimaryDark;

const getActiveInputColor = (viewType: InputViewType) => (theme: Theme) =>
  viewType !== 'edit' ? theme.palette.Border.BorderPrimary : theme.palette.Primary.PrimaryLight;

/** ------------- Styles ------------- */

export const inputCheckboxContainerStyles: Sx = {
  width: '100%',
};

export const inputCheckboxLabelStyles =
  ({ disabled, viewType, size }: InputCheckboxStyleType): Sx =>
  (theme) => ({
    cursor: getCursor(viewType, disabled),
    pointerEvents: viewType !== 'edit' ? 'none' : 'auto',
    verticalAlign: 'bottom',
    padding: 0,
    margin: 0,
    '& span.dmb-uikit-MuiTypography-root': {
      pl: getLabelPaddingBySize(size)(theme),
      fontSize: getLabelFontBySize(size)(theme),
      lineHeight: getLabelLineHeight(size)(theme),
      color: cssImportant(disabled ? theme.palette.Text.TextInactive : theme.palette.Text.TextPrimary),
    },
  });

export const inputCheckboxStyles =
  ({ disabled, viewType, checked, size, indeterminate }: InputCheckboxStyleType): Sx =>
  (theme) => ({
    padding: 0,
    margin: 0,
    background: cssImportant('transparent'),
    cursor: getCursor(viewType, disabled),
    alignSelf: 'baseline',
    /** Rewrite mui styles to our custom */
    '&:hover svg': { color: getHoverInputColor(viewType)(theme) },
    '&:active svg': { color: getActiveInputColor(viewType)(theme) },
    '& svg': {
      fontSize: getIconFontBySize(size)(theme),
      color: cssImportant(countCheckboxColor(viewType, disabled, checked, indeterminate)(theme)),
    },
    /** Remove extra dom element which make some troubles for us */
    '& span.dmb-uikit-MuiTouchRipple-root': {
      display: 'none',
    },
  });

export const inputCheckboxHelperTextStyles =
  (size: MediumSizeType): Sx =>
  (theme) => ({
    pl: getHelperTextPaddingBySize(size)(theme),
  });
