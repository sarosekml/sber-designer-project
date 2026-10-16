import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

export interface TextBadgeProps extends DataTestIdProps {
  /**
   * Sx
   */
  sx?: Sx;
  /**
   * Used to render text elements inside the Avatar.
   * This can be a string.
   */
  children: string;
}
