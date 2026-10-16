import React, { memo } from 'react';

import { TableInternalPlainModel } from '@/components/organisms/Tables/Table/TableProps';

import { ToggleDetailContext } from './components/TableCell/ToggleDetail.context';
import { useToggleDetailContext } from './components/TableCell/useToggleDetailContext';
import {
  HeaderCellContext,
  RootContext,
  TableRowContext,
  useHeaderCellContext,
  useRootContext,
  useTableRowContext,
} from './components';
import { ColumnVisibilityManagerContext, useColumnVisibilityManagerContext } from './plugins';
import { ImmutableState, ImmutableStateController, UiState, UiStateController } from './TableState';

export interface TableContextProviderProps<RowType extends object, Filter extends object> {
  children: React.ReactNode;
  tableProps: TableInternalPlainModel<RowType, Filter>;
  tableState: UiState<RowType> & ImmutableState<RowType>;
  tableStateController: Omit<UiStateController<RowType>, 'setState' | 'resetState'> & ImmutableStateController<RowType>;
  onResetTableSettings?: () => void;
}

/**
 * A HOC Higher-Order Component to provide all necessary contexts to the child components.
 * In the table there are four kind of context for different parts of the UI:
 * *  RootContext
 * *  HeaderCellContext
 * *  TableRowContext
 * *  ColumnVisibilityManagerContext
 * In all existing cases for now the context is used to introduce new functionalities in the
 * existing components avoiding some limitations of the used library,
 * and it's not recommended to use it right now without special necessity.
 */
const TableContextProviderComponent = <RowType extends object, Filter extends object>({
  children,
  tableState: { hiddenColumnNames, selectedRowIndex, order, fixedColumns, scroll },
  tableStateController: { setHiddenColumns, setSelectedRowIndex, setFixedColumns, setScroll },
  tableProps,
  onResetTableSettings,
}: TableContextProviderProps<RowType, Filter>) => {
  const { columns, isEditMode, rowProps, isLoading, messages, canFixColumns, rows } = tableProps;
  const columnVisibilityContextData = useColumnVisibilityManagerContext({
    columns,
    onHiddenColumnNamesChange: setHiddenColumns as (columnNames: string[]) => void,
    hiddenColumnNames,
    order,
    messages,
    onResetTableSettings,
  });

  const tableRowContextData = useTableRowContext({
    tableCode: tableProps.tableCode,
    selectedRowIndex,
    setSelectedRowIndex,
    setScroll,
    scroll,
    rows,
    isEditMode,
    rowProps,
    isLoading,
    messages,
  });
  const toggleDetailContextData = useToggleDetailContext({
    showToggleIcon: tableProps.rowDetailConfig?.showToggleIcon,
  });
  const rootContextData = useRootContext(tableProps);
  const headerCellContextData = useHeaderCellContext(tableProps, setFixedColumns, fixedColumns, canFixColumns);

  return (
    <RootContext.Provider value={rootContextData}>
      <ToggleDetailContext.Provider value={toggleDetailContextData}>
        <HeaderCellContext.Provider value={headerCellContextData}>
          <TableRowContext.Provider value={tableRowContextData}>
            <ColumnVisibilityManagerContext.Provider value={columnVisibilityContextData}>
              {children}
            </ColumnVisibilityManagerContext.Provider>
          </TableRowContext.Provider>
        </HeaderCellContext.Provider>
      </ToggleDetailContext.Provider>
    </RootContext.Provider>
  );
};

export const TableContextProvider = memo(TableContextProviderComponent) as typeof TableContextProviderComponent;
