import React, { FC } from 'react';
import { DialogContent as MaterialDialogContent } from '@mui/material';

import { getDataTestId } from '@/utils';

import { useDialogContentStyles } from './DialogContent.styles';
import { DialogContentProps } from './DialogContent.types';

export const DialogContent: FC<DialogContentProps> = React.memo(
  ({ children, className, dataTestId, sx, useTopPadding }) => {
    const styles = useDialogContentStyles({ useTopPadding, sx });

    return (
      <MaterialDialogContent data-testid={getDataTestId(dataTestId, 'DialogContent')} className={className} sx={styles}>
        {children}
      </MaterialDialogContent>
    );
  },
);
