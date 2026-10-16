import { DataTestIdProps, JustifyType } from '@/types/common.types';
import { Sx } from '@/utils';

import { AlertInDialogProps } from '../DialogAlert';

export interface DialogBodyProps extends DataTestIdProps {
  actions?: React.ReactNode;
  actionsJustify?: JustifyType;
  children: React.ReactNode;
  title?: React.ReactNode;
  closeDialog?: () => void;
  alertTopProps?: AlertInDialogProps;
  alertBottomProps?: AlertInDialogProps;
  contentSx?: Sx;
  /**
   if needed to override Mui inner style for Dialog Content that strictly removes upper padding in Dialog Content, use it as `true`
   Upper padding can be defined exact number with prop `dialogContentPaddingTop`
   */
  addTopPadding?: boolean;
  disabledCloseButton?: boolean;
}
