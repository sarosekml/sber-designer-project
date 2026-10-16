import { TextTypes } from '@/styles/theme/typography';
import { MediumSizeType } from '@/types';

export const fontVariants: Record<MediumSizeType, TextTypes> = {
  lg: 'BodyLReg',
  md: 'BodyMReg',
  sm: 'BodySReg',
};

export const textUnderlineOffset: Record<MediumSizeType, number> = {
  lg: 5,
  md: 3,
  sm: 2,
};
