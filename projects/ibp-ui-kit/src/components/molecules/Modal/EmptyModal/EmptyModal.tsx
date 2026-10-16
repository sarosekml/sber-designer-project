import React, { memo, useCallback, useMemo } from 'react';
import { Dialog, PaperProps } from '@mui/material';

import { getDataTestId, mergeSx } from '@/utils';

import { getPaperSx } from './EmptyModal.style';
import { EmptyModalProps } from './EmptyModal.types';

export const EmptyModal = memo(
  ({ width, height, show = false, closeModal, children, dataTestId, fullScreen, modalSx }: EmptyModalProps) => {
    const paperProps = useMemo<Partial<PaperProps>>(
      () => ({
        sx: mergeSx(getPaperSx({ width, height }), modalSx),
      }),
      [width, height, modalSx],
    );

    const onCloseModal = useCallback(
      (e: React.MouseEvent<HTMLElement>, reason?: 'backdropClick' | 'escapeKeyDown') => {
        e.stopPropagation();
        if (reason === 'backdropClick') {
          return;
        }
        closeModal?.();
      },
      [closeModal],
    );

    return (
      <Dialog
        data-testid={getDataTestId(dataTestId, 'EmptyModal')}
        open={show}
        onClose={onCloseModal}
        fullWidth={true}
        PaperProps={paperProps}
        fullScreen={fullScreen}
      >
        {children}
      </Dialog>
    );
  },
);

EmptyModal.displayName = 'EmptyModal';
