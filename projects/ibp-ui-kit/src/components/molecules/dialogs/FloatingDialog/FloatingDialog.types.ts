import { Sx } from '@/utils';

import { DialogBodyProps } from '../DialogBody';

export interface FloatingDialogProps extends DialogBodyProps {
  height?: string | number;
  width?: string | number | 'fit-content';
  sx?: Sx;
}
