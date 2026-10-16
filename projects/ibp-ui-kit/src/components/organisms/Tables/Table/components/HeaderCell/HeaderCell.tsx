import React, { memo, useContext } from 'react';
import { TableHeaderRow } from '@devexpress/dx-react-grid-material-ui';

import { useCustomRender } from '../../hooks';
import { TableTestKeys } from '../../Table.const';

import { HeaderCellContext } from './HeaderCell.context';
import { getHeaderStyles } from './HeaderCell.styles';

export const HeaderCell = memo((props: TableHeaderRow.CellProps) => {
  const { sortingColumnExtensions } = useContext(HeaderCellContext);
  const sortingConfig = sortingColumnExtensions?.find((it) => it.columnName === props.column.name);
  const sortingDisabled = sortingColumnExtensions?.length && !sortingConfig?.sortingEnabled;

  const render = useCustomRender(props);

  const tableColumnKey = props.tableColumn.key.replace('Symbol(data)_', '');

  return (
    <TableHeaderRow.Cell
      {...props}
      sx={getHeaderStyles({ sortingDisabled: !!sortingDisabled })}
      key={props.column.name}
      data-testid={`${TableTestKeys.tableHeaderCellKey}_${tableColumnKey}`}
    >
      {/* If we have no sorting icon, then we should perform custom render here */}
      {render && sortingDisabled ? render(props) : props.children}
    </TableHeaderRow.Cell>
  );
});

HeaderCell.displayName = 'HeaderCell';
