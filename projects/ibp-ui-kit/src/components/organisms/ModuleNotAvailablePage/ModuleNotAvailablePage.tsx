import React, { memo } from 'react';

import { Button, Grid, Page } from '../../atoms';
import { ErrorBanner } from '../../molecules';

import { ModuleNotAvailablePageProps } from './ModuleNotAvailablePage.types';

const labels = {
  'Go to Dashboard': 'Вернуться на главную',
};

export const ModuleNotAvailablePage = memo(({ title, message, onClickGoHome }: ModuleNotAvailablePageProps) => {
  return (
    <Page dataTestId={'Fail'}>
      <ErrorBanner
        reason={'ServerFail'}
        title={title}
        message={message ?? ''}
        actions={
          <Grid item container spacing={2}>
            <Grid item>
              <Button dataTestId="ToDashboard" onClick={onClickGoHome}>
                {labels['Go to Dashboard']}
              </Button>
            </Grid>
          </Grid>
        }
      />
    </Page>
  );
});

ModuleNotAvailablePage.displayName = 'ModuleNotAvailablePage';
