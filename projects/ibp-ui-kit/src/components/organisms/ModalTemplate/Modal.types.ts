import { ModalProps } from '@/components/molecules';

export interface ModalBaseComponentProps extends Omit<ModalProps, 'visible'> {
  errors?: string[];
}
