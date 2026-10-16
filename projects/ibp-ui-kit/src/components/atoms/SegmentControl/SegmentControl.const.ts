import { TextTypes } from '@/styles/theme/typography';

import { SegmentControlSize } from './SegmentControl.types';

export const fontVariants: Record<SegmentControlSize, TextTypes> = {
  lg: 'ButtonL',
  md: 'ButtonM',
  sm: 'ButtonS',
  xs: 'ButtonXS',
};

export const paddingSegment: Record<SegmentControlSize, string> = {
  lg: '8px 16px',
  md: '8px 12px',
  sm: '6px 8px',
  xs: '4px 6px',
};

export const heightSegment: Record<SegmentControlSize, string> = {
  lg: '48px',
  md: '40px',
  sm: '32px',
  xs: '24px',
};
