import React, { memo } from 'react';
import { InputHiddenFormHandlerProps } from './InputHidden.types';
import { Grid } from '@mui/material';
import { InputTextFormHandler } from '../InputText';
import { emptyString } from '@sber-ibp/core';

export const InputHiddenFormHandler = memo(({ name, hasNullHeight }: InputHiddenFormHandlerProps) => {
  return (
    <Grid sx={{ visibility: 'hidden', ...(hasNullHeight && { height: 0 }) }}>
      <InputTextFormHandler name={name} label={emptyString} />
    </Grid>
  );
});
