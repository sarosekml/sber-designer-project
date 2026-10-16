import { useMemo } from 'react';

import { useEventApi } from '@sber-ibp/core';

import { doNothing } from '@/utils';

import { getTableEventChannelId } from '../Table';
import { TableState, TableStateController } from '../Table/TableState';
import { TableStateControllerEvents } from '../Table/TableState/TableState.events';

const mockTableCode = '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockController: TableStateController<any, any> = {
  resetColumnOrder: doNothing,
  resetColumnWidths: doNothing,
  resetCurrentPage: doNothing,
  resetFilters: doNothing,
  resetFixedColumns: doNothing,
  resetHiddenColumns: doNothing,
  resetPageSize: doNothing,
  resetSelectedRowIndex: doNothing,
  resetSorting: doNothing,
  resetGroupingColumns: doNothing,
  resetSelectedRowsWithCheckbox: doNothing,
  resetState: doNothing,
  setColumnOrder: doNothing,
  setColumnWidths: doNothing,
  setCurrentPage: doNothing,
  setFilters: doNothing,
  setFixedColumns: doNothing,
  setHiddenColumns: doNothing,
  setPageSize: doNothing,
  setSelectedRowIndex: doNothing,
  setSorting: doNothing,
  setGroupingColumns: doNothing,
  setSelectedRowsWithCheckbox: doNothing,
  setState: doNothing,
};

/**
 * This hook provides `controller` to control table state via events. The target table listen to
 * the same event source defined by the table code, so you can control the table using this controller.
 *
 * @param tableCode - using tableCode the hook generate table event id, which table uses to subscribe on
 * controlling events
 *
 * @returns table state controller
 */
export const useTableController = <RowType extends object, Filter extends object>(
  tableCode: string | undefined,
): TableStateController<RowType, Filter> => {
  const channelId = getTableEventChannelId(tableCode ?? mockTableCode, 'toTable');
  const { trigger } = useEventApi<TableStateControllerEvents<RowType, Filter>>(channelId);

  return useMemo(() => {
    if (!tableCode) return mockController;

    return {
      setState: (newState: TableState<RowType, Filter>) => trigger('setState', newState),
      resetState: () => trigger('resetState', undefined),

      // Cacheable state part
      setCurrentPage: (currentPage: TableState<RowType, Filter>['currentPage']) =>
        trigger('setCurrentPage', currentPage),
      setFilters: (filters: TableState<RowType, Filter>['filters']) => trigger('setFilters', filters),
      setPageSize: (pageSize: TableState<RowType, Filter>['pageSize']) => trigger('setPageSize', pageSize),
      setSorting: (sorting: TableState<RowType, Filter>['sorting']) => trigger('setSorting', sorting),

      resetCurrentPage: () => trigger('resetCurrentPage', undefined),
      resetFilters: () => trigger('resetFilters', undefined),
      resetPageSize: () => trigger('resetPageSize', undefined),
      resetSorting: () => trigger('resetSorting', undefined),

      // UI state part
      setColumnOrder: (nextOrder: TableState<RowType, Filter>['order']) => trigger('setColumnOrder', nextOrder),
      setColumnWidths: (nextColumnWidths: TableState<RowType, Filter>['columnWidths']) =>
        trigger('setColumnWidths', nextColumnWidths),
      setFixedColumns: (nextFixedColumns: TableState<RowType, Filter>['fixedColumns']) =>
        trigger('setFixedColumns', nextFixedColumns),
      setHiddenColumns: (hiddenColumnNames: TableState<RowType, Filter>['hiddenColumnNames']) =>
        trigger('setHiddenColumns', hiddenColumnNames),
      setSelectedRowIndex: (selectedRowIndex: TableState<RowType, Filter>['selectedRowIndex']) =>
        trigger('setSelectedRowIndex', selectedRowIndex),
      setGroupingColumns: (newGroupingColumns: TableState<RowType, Filter>['grouping']) =>
        trigger('setGroupingColumns', newGroupingColumns),
      setSelectedRowsWithCheckbox: (
        newSelectedRowsWithCheckbox: TableState<RowType, Filter>['selectedRowsWithCheckbox'],
      ) => trigger('setSelectedRowsWithCheckbox', newSelectedRowsWithCheckbox),

      resetColumnOrder: () => trigger('resetColumnOrder', undefined),
      resetColumnWidths: () => trigger('resetColumnWidths', undefined),
      resetFixedColumns: () => trigger('resetFixedColumns', undefined),
      resetHiddenColumns: () => trigger('resetHiddenColumns', undefined),
      resetSelectedRowIndex: () => trigger('resetSelectedRowIndex', undefined),
      resetGroupingColumns: () => trigger('resetGroupingColumns', undefined),
      resetSelectedRowsWithCheckbox: () => trigger('resetSelectedRowsWithCheckbox', undefined),
    };
  }, [tableCode, trigger]);
};

/**
 * @deprecated use `useTableController` instead
 */
export const useEventBasedTableStateController = useTableController;
