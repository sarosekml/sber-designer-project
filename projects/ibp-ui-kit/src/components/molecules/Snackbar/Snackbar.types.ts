import { SnackbarProps as MuiSnackbarProps } from '@mui/material';

export type SnackbarType = 'error' | 'info' | 'success' | 'warning';

export interface SnackbarProps extends MuiSnackbarProps {
  type?: SnackbarType;
  isOpen?: boolean;
  onClose?: () => void;
  dataTestId?: string;
}
export interface SnackbarTitleStyleProps {
  severity: SnackbarType;
}

export type SnackbarStyleProps = Pick<SnackbarTitleStyleProps, 'severity'>;
