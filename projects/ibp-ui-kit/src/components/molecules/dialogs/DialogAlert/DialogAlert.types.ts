import { AlertProps } from '../../Alert/Alert.types';

export interface AlertInDialogProps extends Omit<AlertProps, 'dataTestId'> {
  dataTestId?: string;
  message?: string;
}

/** @deprecated use `AlertInDialogProps` */
export type AlertInModalProps = AlertInDialogProps;
