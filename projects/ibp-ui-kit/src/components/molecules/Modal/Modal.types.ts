import { Sx } from '@/utils';

import { DialogBodyProps } from '../dialogs/DialogBody';

export interface ModalProps extends Omit<DialogBodyProps, 'dataTestId' | 'closeDialog'> {
  height?: string | number;
  name: string;
  width?: string | number | 'fit-content';
  visible: boolean;
  fullScreen?: boolean;
  sx?: Sx;
  /**
   if needed to override Mui inner style for Dialog Content that strictly removes upper padding in Dialog Content, use it as `true`
   Upper padding can be defined exact number with prop `dialogContentPaddingTop`
   */
  useTopPadding?: boolean;
  closeModal?: () => void;
}
