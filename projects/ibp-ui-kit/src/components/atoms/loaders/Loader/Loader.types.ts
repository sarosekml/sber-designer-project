import { DataTestIdProps, SizeType } from '@/types';
import { Sx } from '@/utils';

export type Color = 'colored' | 'white' | 'disabled';

export interface LoaderProps extends DataTestIdProps {
  className?: string;
  isColored?: boolean;
  size?: SizeType;
  color?: Color;
  sx?: Sx;
}
