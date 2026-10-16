import { TextTypes } from '@/styles/theme/typography';
import { ButtonSize } from '@/types';

export const fontVariants: Record<ButtonSize, TextTypes> = {
  lg: 'ButtonL',
  md: 'ButtonM',
  sm: 'ButtonS',
  xs: 'ButtonS',
};

export const iconSpacings: Record<ButtonSize, number> = {
  lg: 2,
  md: 1.5,
  sm: 1,
  xs: 1,
};

export const iconSizes: Record<ButtonSize, number> = {
  lg: 6,
  md: 5,
  sm: 4,
  xs: 4,
};

export const borderRadius: Record<ButtonSize, number> = {
  lg: 2,
  md: 2,
  sm: 1.5,
  xs: 1,
};
