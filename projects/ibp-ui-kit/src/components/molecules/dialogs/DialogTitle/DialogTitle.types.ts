import { Sx } from '@/utils';

export interface TableStylesType {
  root?: string;
  typography?: string;
}

export interface DialogTitleProps {
  /** @deprecated never used in tag <DialogTitle ... */
  actions?: React.ReactNode;

  children: React.ReactNode;

  /** @deprecated never used in tag <DialogTitle ... */
  id?: string;

  /** @deprecated never used in tag <DialogTitle ... */
  classes?: TableStylesType;

  /** @deprecated never used in tag <DialogTitle ... */
  sx?: Sx;

  dataTestId: string | undefined;

  disabledCloseButton: boolean | undefined;

  closeDialog?: () => void;

  /**
   * @deprecated use `closeDialog` prop
   */
  closeModal?: () => void;
}
