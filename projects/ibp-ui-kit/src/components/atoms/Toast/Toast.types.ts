import { ReactNode } from 'react';
import { SnackbarProps } from '@mui/material';

export interface ToastProps extends SnackbarProps {
  isOpen?: boolean;
  onClose?: () => void;
  dataTestId?: string;
  message: ReactNode;
  key?: string;
  blurBackground?: boolean;
  showLoader?: boolean;
  type?: 'success' | 'progress';
}
