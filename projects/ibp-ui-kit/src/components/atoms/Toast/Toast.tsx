import React, { memo, SyntheticEvent, useMemo } from 'react';
import { Dialog, Snackbar } from '@mui/material';

import { uuid } from '@sber-ibp/core';

import { Grid } from '@/components/atoms/gridTiles';
import { Icon } from '@/components/atoms/Icon';
import { getDataTestId, mergeSx } from '@/utils';

import { Loader } from '../loaders';
import { SxBox } from '../SxBox';
import { Text } from '../typography';

import { defaultToastSx } from './Toast.styles';
import { ToastProps } from './Toast.types';

export const Toast = memo(
  ({
    dataTestId,
    autoHideDuration = 3000,
    isOpen,
    onClose,
    sx,
    message,
    key,
    blurBackground,
    showLoader,
    type = 'progress',
  }: ToastProps) => {
    const handleClose = useMemo(
      () =>
        onClose
          ? (_event?: SyntheticEvent | Event, reason?: string) => {
              if (reason === 'timeout') onClose();
            }
          : undefined,
      [onClose],
    );

    const toastSx = useMemo(() => mergeSx(defaultToastSx, sx), [sx]);

    const keyToast = useMemo<string>(() => uuid(), []);
    const body = (
      <Snackbar
        open={isOpen}
        autoHideDuration={autoHideDuration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        data-testid={getDataTestId(dataTestId, 'Toast')}
        key={key ?? keyToast}
        sx={toastSx}
      >
        <SxBox className={'toast-body'}>
          <Grid container spacing={2} alignItems="center">
            {type === 'success' && (
              <Grid item>
                <Icon name={'CheckCircle'} size="sm" color="success" />
              </Grid>
            )}
            {showLoader ? (
              <Grid item>
                <Loader size="xs" />
              </Grid>
            ) : null}
            <Grid item xs>
              {typeof message === 'string' ? <Text type="BodySReg">{message}</Text> : message}
            </Grid>
          </Grid>
        </SxBox>
      </Snackbar>
    );

    return blurBackground ? (
      <Dialog data-testid={getDataTestId(dataTestId, 'EmptyModal')} open={Boolean(isOpen)}>
        {body}
      </Dialog>
    ) : (
      body
    );
  },
);

Toast.displayName = 'Toast';
