import { DataTestIdProps } from '@/types';

export interface SkeletonProps extends DataTestIdProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  animation?: false | 'pulse' | 'wave';
}
