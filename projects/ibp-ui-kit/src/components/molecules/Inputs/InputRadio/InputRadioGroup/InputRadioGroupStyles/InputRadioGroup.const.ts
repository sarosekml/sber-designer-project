import { TextTypes } from '@/styles/theme/typography';
import { MediumSizeType } from '@/types/common.types';

export const fontVariants: Record<MediumSizeType, TextTypes> = {
  lg: 'BodyLStrongSmb',
  md: 'BodyMStrongSmb',
  sm: 'BodySStrongSmb',
};

export const textMargin: Record<MediumSizeType, number> = {
  lg: 4,
  md: 3,
  sm: 2,
};

export const listGap: Record<MediumSizeType, number> = {
  lg: 4,
  md: 3,
  sm: 2,
};
