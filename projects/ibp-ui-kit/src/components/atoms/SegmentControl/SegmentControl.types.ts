import { DataTestIdProps, SizeType } from '@/types';

export type SegmentControlSize = Exclude<SizeType, 'xl'>;

export interface SegmentControlProps extends DataTestIdProps {
  selectedIndex?: number;
  onIndexChange?: (index: number) => void;
  segmentsText?: string[];
  disabled?: boolean;
  size?: SegmentControlSize;
}

export interface StyledProps {
  size: SegmentControlSize;
}
