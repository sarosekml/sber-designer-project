import React, { memo, useCallback } from 'react';
import { FallbackProps } from 'react-error-boundary';
import { NavigateFunction } from 'react-router';

import { NavigateCallback, subStringWrapper } from '@sber-ibp/core';

import { Button, Grid } from '../../atoms';
import { ErrorSection } from '../../molecules';

const labels = {
  'Reset module': 'Обновить модуль',
  'Back to main page': 'Вернуться на главную страницу',
  'Additional information': 'Дополнительная информация',
  'Logical or contract error on the client side': 'Логическая или контрактная ошибка на стороне клиента',
  'Unknown error': 'Неопределённая ошибка',
};

export const ErrorFallback = memo(
  ({
    error,
    resetErrorBoundary,
    customNavigate,
    navigate,
  }: FallbackProps & { customNavigate?: NavigateCallback<string>; navigate?: NavigateFunction }) => {
    const errorMessage = `${labels['Additional information']}: ${
      error.stack ?? error.message ?? labels['Unknown error']
    }`;

    const backToMainPage = useCallback(() => {
      if (customNavigate) customNavigate('/', null);
      if (navigate) navigate('/');
    }, [customNavigate, navigate]);

    return (
      <ErrorSection
        reason={'Forbidden'}
        actions={
          <Grid container item spacing={2}>
            <Grid item>
              <Button onClick={resetErrorBoundary} dataTestId="ResetErrorButton">
                {labels['Reset module']}
              </Button>
            </Grid>
            <Grid item>
              <Button onClick={backToMainPage} dataTestId="BackToMainPage">
                {labels['Back to main page']}
              </Button>
            </Grid>
          </Grid>
        }
        message={subStringWrapper(errorMessage, 1200)}
        title={labels['Logical or contract error on the client side']}
        size={'md'}
      />
    );
  },
);

ErrorFallback.displayName = 'ErrorFallback';
