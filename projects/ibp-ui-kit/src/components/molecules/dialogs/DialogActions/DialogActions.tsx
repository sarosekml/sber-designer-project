import React from 'react';
import { DialogActions as MuiDialogActions } from '@mui/material';
import clsx from 'clsx';

import { getDataTestId } from '@/utils';

import { getStyles } from './DialogActions.styles';
import { PropTypes } from './DialogActions.types';

export const DialogActions = React.memo(
  ({
    children,
    justify = 'flex-start',
    disableSpacing = false,
    className = '',
    dataTestId,
  }: PropTypes): JSX.Element => {
    const styles = getStyles({ justify });

    return (
      <MuiDialogActions
        data-testid={getDataTestId(dataTestId, 'DialogActions')}
        className={clsx(className, 'DialogActions_root')}
        disableSpacing={disableSpacing}
        sx={styles}
      >
        {children}
      </MuiDialogActions>
    );
  },
);
