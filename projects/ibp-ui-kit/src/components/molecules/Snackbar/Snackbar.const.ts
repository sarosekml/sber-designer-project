import { amber, lightBlue, lightGreen, red } from '@/styles';

import { SnackbarType } from './Snackbar.types';

export const snackbarColors: Record<SnackbarType, string> = {
  error: red['A200'],
  info: lightBlue[50],
  success: lightGreen[50],
  warning: amber[50],
};

export const iconColors: Record<SnackbarType, string> = {
  error: red[700],
  info: lightBlue[600],
  success: lightGreen[600],
  warning: amber[600],
};
