import { TextTypes } from '@/styles/theme/typography';
import { MediumSizeType } from '@/types/common.types';

export const fontVariants: Record<MediumSizeType, TextTypes> = {
  lg: 'BodyLReg',
  md: 'BodyMReg',
  sm: 'BodySReg',
};

export const paddingRadioButton: Record<MediumSizeType, number> = {
  lg: 3.5,
  md: 2.5,
  sm: 2,
};

export const iconSize: Record<MediumSizeType, number> = {
  lg: 6,
  md: 5,
  sm: 4,
};

export const helperTextPadding: Record<MediumSizeType, number> = {
  lg: iconSize.lg + paddingRadioButton.lg,
  md: iconSize.md + paddingRadioButton.md,
  sm: iconSize.sm + paddingRadioButton.sm,
};
