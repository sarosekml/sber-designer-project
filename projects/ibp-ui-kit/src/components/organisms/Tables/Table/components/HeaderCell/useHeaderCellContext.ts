import { useMemo } from 'react';

import {
  ColumnExtension,
  FixedColumnsInfo,
  SortingExtension,
  TableInternalPlainModel,
} from '@/components/organisms/Tables/Table/TableProps';

import { HeaderCellContextData } from './HeaderCell.context';

/**
 * There is no ability to pass additional parameters as props to the header cells,
 * so we pass them via context. Additional parameters are needed for applying
 * sorting and column extensions.
 */
export const useHeaderCellContext = <RowType extends object, Filter extends object>(
  props: TableInternalPlainModel<RowType, Filter>,
  setFixedColumn: (fixedColumns: FixedColumnsInfo<RowType>) => void,
  fixedColumns: FixedColumnsInfo<RowType>,
  canFixColumns: boolean,
): HeaderCellContextData<object> => {
  const { sortingColumnExtensions, tableColumnExtensions } = props;

  return useMemo(
    () => ({
      tableColumnExtensions: tableColumnExtensions as ColumnExtension<object>[],
      sortingColumnExtensions: sortingColumnExtensions as SortingExtension<object>[],
      canFixColumns,
      setFixedColumn: (name, value) => {
        const newColumns = new Map(fixedColumns);
        newColumns.set(name, value);
        setFixedColumn(newColumns);
      },
      getColumnFixedState: (name) => fixedColumns.get(name),
    }),
    [tableColumnExtensions, sortingColumnExtensions, canFixColumns, fixedColumns, setFixedColumn],
  );
};
