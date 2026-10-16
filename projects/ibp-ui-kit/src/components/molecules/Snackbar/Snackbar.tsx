import React, { memo, SyntheticEvent } from 'react';
import { Error, Warning } from '@mui/icons-material';
import { Box, Snackbar as MuiSnackbar } from '@mui/material';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/typography';
import { getDataTestId } from '@/utils';

import { getSnackbarAlertStyles, getSnackbarTitleStyles } from './Snackbar.style';
import { SnackbarProps } from './Snackbar.types';
import { SnackbarAlert } from './SnackbarAlert';

export const Snackbar = memo(
  ({
    dataTestId,
    message = '',
    title = '',
    type = 'warning',
    action,
    autoHideDuration = 7000,
    isOpen,
    onClose,
    sx,
  }: SnackbarProps) => {
    const severity = type;

    const snackbarTitleStyle = getSnackbarTitleStyles({ severity });
    const snackbarAlertStyle = getSnackbarAlertStyles({ severity });

    const handleClose = onClose
      ? (event?: SyntheticEvent | Event, reason?: string) => {
          if (reason === 'clickaway' || !event) return;
          onClose();
        }
      : undefined;

    return (
      <MuiSnackbar
        open={isOpen}
        autoHideDuration={autoHideDuration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={sx}
        data-testid={getDataTestId(dataTestId, 'Snackbar')}
      >
        <SnackbarAlert
          iconMapping={{
            error: <Error fontSize="inherit" data-testid={getDataTestId(dataTestId, 'SnackbarIcon')} />,
            warning: <Warning fontSize="inherit" data-testid={getDataTestId(dataTestId, 'SnackbarIcon')} />,
            success: (
              <Icon
                name={'CheckCircleFilled'}
                data-testid={getDataTestId(dataTestId, 'SnackbarIcon')}
                size={'md'}
                color={'success'}
              />
            ),
            info: (
              <Icon
                name={'InfoCircleFilled'}
                data-testid={getDataTestId(dataTestId, 'SnackbarIcon')}
                size={'md'}
                color={'info'}
              />
            ),
          }}
          onClose={handleClose}
          severity={severity}
          sx={snackbarAlertStyle}
          data-testid={getDataTestId(dataTestId, 'SnackbarAlert')}
        >
          <Text sx={snackbarTitleStyle} data-testid={getDataTestId(dataTestId, 'Title')}>
            {title}
          </Text>
          <Box sx={{ mb: 2 }} data-testid={getDataTestId(dataTestId, 'SnackbarMessage')}>
            {message}
          </Box>
          {action}
        </SnackbarAlert>
      </MuiSnackbar>
    );
  },
);

Snackbar.displayName = 'Snackbar';
