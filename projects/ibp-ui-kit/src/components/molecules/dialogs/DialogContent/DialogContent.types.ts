import { DataTestIdProps } from '@/types/common.types';
import { Sx } from '@/utils';

export interface DialogContentProps extends DataTestIdProps {
  className?: string;
  sx?: Sx;
  useTopPadding?: boolean;
  children: React.ReactNode;
}
