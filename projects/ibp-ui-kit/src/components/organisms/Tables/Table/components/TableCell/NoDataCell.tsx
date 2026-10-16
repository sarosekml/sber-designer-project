import { Table } from '@devexpress/dx-react-grid-material-ui';
import React, { memo, useCallback, useContext } from 'react';
import { defaultTableMessage } from '../../TableProps/useTableProps';
import { TableRowContext } from '../TableRow/TableRow.context';

export const NoDataCell = memo((props: Table.NoDataCellProps) => {
  const { isLoading, messages = defaultTableMessage } = useContext(TableRowContext);
  const getMessage = useCallback(() => {
    return isLoading ? messages.loading : messages.noData;
  }, [isLoading, messages]);
  return <Table.NoDataCell {...props} getMessage={getMessage}></Table.NoDataCell>;
});

NoDataCell.displayName = 'NoDataCell';
