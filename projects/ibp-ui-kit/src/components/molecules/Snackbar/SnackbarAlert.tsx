import MuiAlert, { AlertProps } from '@mui/material/Alert';
import React, { forwardRef } from 'react';

export const SnackbarAlert = forwardRef<HTMLDivElement, AlertProps>((props, ref) => {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});
