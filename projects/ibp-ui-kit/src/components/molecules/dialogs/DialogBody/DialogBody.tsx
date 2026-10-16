import React, { memo } from 'react';
import { ModalAlert } from '../DialogAlert';
import { DialogBodyProps } from './DialogBody.types';
import { DialogTitle } from '../DialogTitle';
import { DialogContent } from '../DialogContent';
import { DialogActions } from '../DialogActions';

const root = 'Dialog';

export const DialogBody = memo(
  ({
    actions,
    actionsJustify = 'flex-end',
    alertBottomProps,
    alertTopProps,
    children,
    closeDialog,
    contentSx,
    disabledCloseButton,
    dataTestId = root,
    title,
    addTopPadding,
  }: DialogBodyProps) => {
    return (
      <React.Fragment>
        {!!title && (
          <DialogTitle dataTestId={dataTestId} disabledCloseButton={disabledCloseButton} closeDialog={closeDialog}>
            {title}
          </DialogTitle>
        )}

        {alertTopProps ? <ModalAlert dataTestId={`${dataTestId}_Top`} {...alertTopProps} /> : null}

        <DialogContent
          className={`${root}__dialogBody`}
          dataTestId={dataTestId}
          sx={contentSx}
          useTopPadding={addTopPadding}
        >
          {children}
        </DialogContent>

        {alertBottomProps ? <ModalAlert dataTestId={`${dataTestId}_Bottom`} {...alertBottomProps} /> : null}

        {actions ? (
          <DialogActions justify={actionsJustify} dataTestId={dataTestId}>
            {actions}
          </DialogActions>
        ) : null}
      </React.Fragment>
    );
  },
);

DialogBody.displayName = root;
