import { TextTypes } from '@/styles/theme/typography';
import { MediumSizeType } from '@/types';

export const fontVariants: Record<MediumSizeType, TextTypes> = {
  lg: 'BodyLReg',
  md: 'BodyMReg',
  sm: 'BodySReg',
};

export const paddingBottom: Record<MediumSizeType, string> = {
  lg: '12px',
  md: '10px',
  sm: '8px',
};
