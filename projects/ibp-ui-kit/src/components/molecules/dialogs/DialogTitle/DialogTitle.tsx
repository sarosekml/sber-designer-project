import React, { memo } from 'react';
import { DialogTitle as MuiDialogTitle } from '@mui/material';
import clsx from 'clsx';

import { SxBox } from '@/components/atoms/SxBox';
import { Text } from '@/components/atoms/typography';

import { DialogCloseButton } from '../DialogCloseButton/DialogCloseButton';

import { dialogTitleSx, dialogTitleTextSx } from './DialogTitle.styles';
import { DialogTitleProps } from './DialogTitle.types';

export const DialogTitle = memo(
  ({ children, actions, classes, id, dataTestId, disabledCloseButton, closeDialog, closeModal }: DialogTitleProps) => {
    const titleTestId = `${dataTestId}_DialogTitle`;
    const close = closeDialog || closeModal;
    return (
      <MuiDialogTitle
        className={clsx(classes?.root, 'DialogTitle_root')}
        data-testid={titleTestId}
        id={id}
        sx={dialogTitleSx}
      >
        <Text type="H4StrongSmb" className={clsx(classes?.typography)} dataTestId={titleTestId} sx={dialogTitleTextSx}>
          {children}
        </Text>

        {!!actions && <SxBox component={'div'}>{actions}</SxBox>}
        {!!close && <DialogCloseButton dataTestId={dataTestId} disabled={disabledCloseButton} onClick={close} />}
      </MuiDialogTitle>
    );
  },
);

DialogTitle.displayName = 'DialogTitle';
