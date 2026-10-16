import React, { memo } from 'react';

import { DialogBody } from '../dialogs/DialogBody';

import { EmptyModal } from './EmptyModal';
import { ModalProps } from './Modal.types';

export const Modal = memo<ModalProps>(
  ({ useTopPadding, fullScreen, height, name, sx, visible, width, closeModal, ...bodyProps }) => {
    return (
      <EmptyModal
        width={width}
        height={height}
        closeModal={closeModal}
        show={visible}
        dataTestId={name}
        fullScreen={fullScreen}
        modalSx={sx}
      >
        <DialogBody {...bodyProps} closeDialog={closeModal} addTopPadding={useTopPadding} dataTestId={name} />
      </EmptyModal>
    );
  },
);

Modal.displayName = 'Modal';
