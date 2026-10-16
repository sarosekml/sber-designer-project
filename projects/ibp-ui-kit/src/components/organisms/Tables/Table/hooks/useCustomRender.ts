import { TableHeaderRow as TableHeaderRowBase } from '@devexpress/dx-react-grid';
import { TableHeaderRow } from '@devexpress/dx-react-grid-material-ui';
import { useContext, useMemo } from 'react';
import { HeaderCellContext } from '../components/HeaderCell/HeaderCell.context';

export const useCustomRender = (props: TableHeaderRow.CellProps | TableHeaderRowBase.SortLabelProps) => {
  const { tableColumnExtensions } = useContext(HeaderCellContext);
  return useMemo(
    () =>
      tableColumnExtensions?.length
        ? tableColumnExtensions.find((it) => it.columnName === props.column.name)?.render
        : null,
    [tableColumnExtensions, props.column.name],
  );
};
