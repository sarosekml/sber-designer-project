import React, { memo } from 'react';

import { Button, Grid, Page } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules';

const root = 'PermissionDeniedPage';

const labels = {
  'Return to main page': 'Вернуться на главную страницу',
  'Resource is unavailable': 'Ресурс недоступен',
  'Check access and authorization': 'Проверьте авторизацию и доступы',
};

export interface PermissionDeniedPageProps {
  onReturnToMain: () => void;
}

export const PermissionDeniedPage = memo(({ onReturnToMain }: PermissionDeniedPageProps) => {
  const Actions = () => (
    <Grid item sizes={{ xs: 12 }}>
      <Button dataTestId={'PermissionDeniedButton'} onClick={onReturnToMain} type={'accent'}>
        {labels['Return to main page']}
      </Button>
    </Grid>
  );

  return (
    <Page dataTestId={root}>
      <ErrorBanner
        reason={'Forbidden'}
        title={labels['Resource is unavailable']}
        message={labels['Check access and authorization']}
        actions={<Actions />}
      />
    </Page>
  );
});

PermissionDeniedPage.displayName = root;
