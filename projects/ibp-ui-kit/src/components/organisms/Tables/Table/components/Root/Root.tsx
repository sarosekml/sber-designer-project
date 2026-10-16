import React, { memo, useContext } from 'react';
import { Grid as DEGrid } from '@devexpress/dx-react-grid-material-ui';

import { getDataTestId } from '@/utils';

import { TableTestKeys } from '../../Table.const';

import { RootContext } from './Root.context';
import { GridRootProps } from './Root.types';

export const Root = memo<GridRootProps>((props) => {
  const { dataTestId } = useContext(RootContext);
  return (
    <DEGrid.Root
      style={{ width: '100%' }}
      {...props}
      data-testid={getDataTestId(dataTestId, `${TableTestKeys.tableRootKey}`)}
    />
  );
});

Root.displayName = 'TableRoot';
