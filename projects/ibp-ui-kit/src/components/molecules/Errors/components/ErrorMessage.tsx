import React from 'react';

import { Grid } from '@/components/atoms';
import { Text } from '@/components/atoms/typography';

interface ErrorMessageProps {
  message?: React.ReactNode;
  disabled?: boolean;
}

export const ErrorMessage = ({ message, disabled }: ErrorMessageProps) => {
  if (!message) return null;
  return (
    <Grid item>
      <Text
        dataTestId={'ErrorSection'}
        sx={(theme) => ({
          color: disabled ? theme.palette.Disabled.Disabled : theme.palette.Text.TextSecondary,
          maxWidth: '30ch',
        })}
        type="BodyLReg"
        className="error__text"
      >
        {message}
      </Text>
    </Grid>
  );
};
