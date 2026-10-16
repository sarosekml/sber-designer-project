import React, { memo } from 'react';
import { useTheme } from '@mui/material';

import { Grid } from '@/components/atoms';
import { Text } from '@/components/atoms/typography';
import { Alert } from '@/components/molecules/Alert';
import { getDataTestId } from '@/utils';

import { AlertInDialogProps } from './DialogAlert.types';

interface ModalAlertProps extends AlertInDialogProps {
  dataTestId: string;
}

export const DialogAlert = memo(({ title, message, children, dataTestId, ...props }: ModalAlertProps) => {
  const theme = useTheme();
  if (!title && !message && !children) return null;
  return (
    <Grid>
      <Alert isDisableStyleAlertText dataTestId={dataTestId} isOpen expandable={false} title={title} {...props}>
        {message ? (
          <Text
            color={theme.palette.Text.TextSecondary}
            dataTestId={getDataTestId(dataTestId, 'Alert')}
            type="BodyXSExtensive"
          >
            {message}
          </Text>
        ) : (
          children
        )}
      </Alert>
    </Grid>
  );
});
DialogAlert.displayName = 'DialogAlert';

/** @deprecated use `DialogAlert` */
export const ModalAlert = DialogAlert;
