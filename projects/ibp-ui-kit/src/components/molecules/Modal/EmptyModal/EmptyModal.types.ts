import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

export interface Props extends DataTestIdProps {
  show: boolean;
  closeModal?: () => void;
  children?: React.ReactNode;
  fullScreen?: boolean;
}

export interface DialogStyleProps {
  width?: string | number;
  height?: string | number;
  modalSx?: Sx;
}

export type EmptyModalProps = Omit<DialogStyleProps, 'theme'> & Props;
