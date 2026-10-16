import React, { memo } from 'react';
import { FallbackProps } from 'react-error-boundary';

import { Button, Grid } from '@/components/atoms';

import { ErrorSection } from '../ErrorSection';

/*@todo remove subStringWrapper when core-lib dependency appears */
export const subStringWrapper = (value: string, length = 20) => {
  if (value.length <= length) return value;
  return `${value.substring(0, length)}...`;
};

const labels = {
  'Additional information': 'Дополнительная информация',
  'Unknown error': 'Неопределенная ошибка',
  'Reset module': 'Обновить модуль',
  'Back to main page': 'Вернутся на главную страницу',
  'Logical or contract error on the client side': 'Логическая или контрактная ошибка на стороне клиента',
};

export interface ModuleErrorFallbackProps extends FallbackProps {
  onBackToMainPage: () => void;
}

export const ModuleErrorFallback = memo(({ error, resetErrorBoundary, onBackToMainPage }: ModuleErrorFallbackProps) => {
  const errorMessage = `${labels['Additional information']}: ${
    error.stack ?? error.message ?? labels['Unknown error']
  }`;

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
            <Button onClick={onBackToMainPage} dataTestId="BackToMainPage">
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
});

ModuleErrorFallback.displayName = 'ModuleErrorFallback';
