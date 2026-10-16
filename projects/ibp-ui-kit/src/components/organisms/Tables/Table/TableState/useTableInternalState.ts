import { useCallback, useMemo, useState } from 'react';

import { TableInternalPlainModel } from '../TableProps';

import {
  DataFetchingState,
  ImmutableStateController,
  TableState,
  TableStateController,
  UiState,
} from './TableState.types';
import { useDataFetchingState } from './useDataFetchingState';
import { useImmutableState } from './useImmutableState';
import { useUiState } from './useUiState';

/**
 * In this hook we combine two states.
 */
export const useTableInternalState = <RowType extends object, Filter extends object>({
  defaultState,
  initialState,
  onTableStateChanged,
}: TableInternalPlainModel<RowType, Filter>) => {
  const [tableState, _setState] = useState<TableState<RowType, Filter>>({
    ...defaultState,
    ...initialState,
  });

  const onSubStateChanged = useCallback(
    (newSubState: DataFetchingState<RowType, Filter> | UiState<RowType>) =>
      _setState((prevState) => ({
        ...prevState,
        ...newSubState,
      })),
    [],
  );

  const { controller: dataFetchingStateController, dataFetchingState } = useDataFetchingState<RowType, Filter>(
    useMemo(
      () =>
        initialState
          ? {
              currentPage: initialState.currentPage,
              pageSize: initialState.pageSize,
              sorting: initialState.sorting,
              filters: initialState.filters,
            }
          : undefined,
      [initialState],
    ),
    useMemo(
      () => ({
        currentPage: defaultState.currentPage,
        pageSize: defaultState.pageSize,
        sorting: defaultState.sorting,
        filters: defaultState.filters,
      }),
      [defaultState],
    ),
    onSubStateChanged,
  );

  const { controller: tableUiStateController, uiState } = useUiState<RowType>(
    useMemo(
      () =>
        initialState
          ? {
              columnWidths: initialState.columnWidths,
              hiddenColumnNames: initialState.hiddenColumnNames,
              order: initialState.order,
              selectedRowIndex: initialState.selectedRowIndex,
              fixedColumns: initialState.fixedColumns,
              grouping: initialState.grouping,
              selectedRowsWithCheckbox: initialState.selectedRowsWithCheckbox,
            }
          : undefined,
      [initialState],
    ),
    useMemo(
      () => ({
        columnWidths: defaultState.columnWidths,
        hiddenColumnNames: defaultState.hiddenColumnNames,
        order: defaultState.order,
        selectedRowIndex: defaultState.selectedRowIndex,
        fixedColumns: defaultState.fixedColumns,
        grouping: defaultState.grouping,
        selectedRowsWithCheckbox: defaultState.selectedRowsWithCheckbox,
      }),
      [defaultState],
    ),
    onSubStateChanged,
  );

  const { controller: immutableStateController, immutableState } = useImmutableState<RowType, Filter>(
    useMemo(
      () =>
        initialState
          ? {
              scroll: initialState.scroll,
            }
          : undefined,
      [initialState],
    ),
    useMemo(
      () => ({
        scroll: defaultState.scroll,
      }),
      [defaultState],
    ),
    tableState,
    onTableStateChanged,
  );

  // Merge two states
  const setState = useCallback(
    (newState: TableState<RowType, Filter>) => {
      dataFetchingStateController.setState({
        currentPage: newState.currentPage,
        pageSize: newState.pageSize,
        sorting: newState.sorting,
        filters: newState.filters,
      });
      tableUiStateController.setState({
        columnWidths: newState.columnWidths,
        hiddenColumnNames: newState.hiddenColumnNames,
        order: newState.order,
        selectedRowIndex: newState.selectedRowIndex,
        fixedColumns: newState.fixedColumns,
        grouping: newState.grouping,
        selectedRowsWithCheckbox: newState.selectedRowsWithCheckbox,
      });
    },
    [dataFetchingStateController, tableUiStateController],
  );

  const resetState = useCallback(() => {
    dataFetchingStateController.resetState();
    tableUiStateController.resetState();
  }, [dataFetchingStateController, tableUiStateController]);

  const controller = useMemo<TableStateController<RowType, Filter> & ImmutableStateController<RowType>>(
    () => ({
      ...tableUiStateController,
      ...dataFetchingStateController,
      ...immutableStateController,
      setState,
      resetState,
    }),
    [resetState, setState, dataFetchingStateController, tableUiStateController],
  );

  return {
    // Table state and controller
    tableState,
    controller,
    // uiState state and its controller
    uiState,
    tableUiStateController,
    // dataFetchingState state and its controller
    dataFetchingState,
    dataFetchingStateController,
    // immutableState state and its controller
    immutableState,
    immutableStateController,
  };
};
