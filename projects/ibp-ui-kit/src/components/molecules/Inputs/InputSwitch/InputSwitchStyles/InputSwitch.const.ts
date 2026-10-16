import { MediumSizeType } from '@/types/common.types';

export const inputSwitchCircleSize: Record<MediumSizeType, number> = {
  sm: 3,
  md: 4,
  lg: 5,
};

export const inputSwitchTrackWidth: Record<MediumSizeType, number> = {
  sm: 5,
  md: 6.5,
  lg: 8.5,
};

export const inputSwitchTrackHeight: Record<MediumSizeType, number> = {
  sm: 2,
  md: 2.5,
  lg: 3.5,
};

export const inputSwitchPadding: Record<MediumSizeType, number> = {
  sm: 1.5,
  md: 1.75,
  lg: 3,
};

export const inputSwitchHeight: Record<MediumSizeType, number> = {
  sm: inputSwitchTrackHeight.sm + 2 * inputSwitchPadding.sm,
  md: inputSwitchTrackHeight.md + 2 * inputSwitchPadding.md,
  lg: inputSwitchTrackHeight.lg + 2 * inputSwitchPadding.lg,
};

export const inputSwitchThumbTransformTranslateX: Record<MediumSizeType, number> = {
  sm: 3,
  md: 4,
  lg: 5,
};

export const inputSwitchFontSize: Record<MediumSizeType, number> = {
  lg: 4.5,
  md: 4,
  sm: 3.5,
};

export const inputSwitchFontLineHeight: Record<MediumSizeType, number> = {
  lg: 6,
  md: 5,
  sm: 4,
};

export const inputSwitchLabelPadding: Record<MediumSizeType, number> = {
  lg: 1.75,
  md: 2,
  sm: 1,
};

export const inputSwitchHelperTextPadding: Record<MediumSizeType, number> = {
  lg: inputSwitchPadding.lg * 2 + inputSwitchTrackWidth.lg + inputSwitchLabelPadding.lg,
  md: inputSwitchPadding.md * 2 + inputSwitchTrackWidth.md + inputSwitchLabelPadding.md,
  sm: inputSwitchPadding.sm * 2 + inputSwitchTrackWidth.sm + inputSwitchLabelPadding.sm,
};
