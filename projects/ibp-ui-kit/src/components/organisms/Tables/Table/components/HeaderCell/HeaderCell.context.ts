import { createContext } from 'react';
import { ColumnExtension, ColumnName, SortingExtension } from '../../TableProps';
import { FixedSide } from '@sber-ibp/core';

export interface HeaderCellContextData<RowType extends object> {
  tableColumnExtensions?: ColumnExtension<RowType>[];
  sortingColumnExtensions?: SortingExtension<RowType>[];
  setFixedColumn?: (columnName: ColumnName<RowType>, value: FixedSide | undefined) => void;
  getColumnFixedState?: (columnName: ColumnName<RowType>) => FixedSide | undefined;
  canFixColumns?: boolean;
}

export const HeaderCellContext = createContext<HeaderCellContextData<object>>({});
