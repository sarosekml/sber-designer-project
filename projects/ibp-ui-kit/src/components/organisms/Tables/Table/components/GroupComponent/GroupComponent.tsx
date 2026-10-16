import React, { memo } from 'react';
import { TableGroupRow } from '@devexpress/dx-react-grid-material-ui';

import { SxBox } from '@/components/atoms';

export const GroupComponent = memo((props: TableGroupRow.ContentProps) => {
  return <SxBox component={'strong'}> {props.row.value?.render?.() ?? props.row.value}</SxBox>;
});

GroupComponent.displayName = 'GroupComponent';
