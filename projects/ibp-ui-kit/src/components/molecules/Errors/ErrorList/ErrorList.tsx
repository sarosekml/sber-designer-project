import React, { memo, useCallback } from 'react';

import { isEmpty } from '@sber-ibp/core';

import { Grid } from '@/components/atoms';
import { gridSizes } from '@/utils';

import { Alert } from '../../Alert';

import { ErrorListProps } from './ErrorList.types';

export const ErrorList = memo(({ alertTitle, errors, removeError }: ErrorListProps) => {
  const onClose = useCallback(() => {
    removeError?.();
  }, [removeError]);

  const isVisible = !isEmpty(errors);

  return (
    //  this margin make additional space on bottom when errorlist is one of modalDialog children.
    <Grid container item spacing={4} mb={isVisible ? 0 : 4}>
      {isVisible ? (
        <Grid item sizes={gridSizes(12)} mb={1}>
          <Alert severity={'error'} dataTestId={'Error'} title={alertTitle ?? 'Error'} onClose={onClose} isOpen>
            <Grid item container>
              {errors?.map((error, index) => (
                <Grid key={index} item sizes={gridSizes(12)}>
                  {errors.length > 1 ? `${index + 1}. ${error}` : error}
                </Grid>
              ))}
            </Grid>
          </Alert>
        </Grid>
      ) : null}
    </Grid>
  );
});
