import React, { useContext } from 'react';
import { TableRowDetail } from '@devexpress/dx-react-grid-material-ui';

import { ToggleCell } from './ToggleCell';
import { ToggleDetailContext } from './ToggleDetail.context';

export const ToggleCellComponent = React.memo((props: TableRowDetail.ToggleCellProps) => {
  const { showToggleIcon } = useContext(ToggleDetailContext);

  const Component = ToggleCell;
  return <Component {...props} showToggleIcon={showToggleIcon} />;
});
