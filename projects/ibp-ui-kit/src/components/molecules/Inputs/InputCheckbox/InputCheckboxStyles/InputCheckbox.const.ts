import { MediumSizeType } from '@/types/common.types';

export const inputCheckboxLabelPaddings: Record<MediumSizeType, number> = {
  sm: 1.5,
  md: 2,
  lg: 3,
};

export const inputCheckboxIconFontSizes: Record<MediumSizeType, number> = {
  sm: 4,
  md: 5,
  lg: 6,
};

export const inputCheckboxLabelFontSizes: Record<MediumSizeType, number> = {
  sm: 3.5,
  md: 4,
  lg: 4.5,
};

export const inputCheckboxLabelLineHeight: Record<MediumSizeType, number> = {
  sm: 4,
  md: 5,
  lg: 6,
};

export const inputCheckboxHelperTextPaddings: Record<MediumSizeType, number> = {
  sm: inputCheckboxIconFontSizes.sm + inputCheckboxLabelPaddings.sm,
  md: inputCheckboxIconFontSizes.md + inputCheckboxLabelPaddings.md,
  lg: inputCheckboxIconFontSizes.lg + inputCheckboxLabelPaddings.lg,
};
