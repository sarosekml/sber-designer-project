import { useCallback, useMemo, useState } from 'react';

import { isEqual } from '@sber-ibp/core';

import { ColumnName, ColumnWidthInfo, FixedColumnsInfo } from '../TableProps';

import { UiState, UiStateController } from './TableState.types';

/**
 * Table component has two parts of the state:
 * - the one which defines the data fetching state
 * - the one which defines the ui state
 *
 * This hook provides the parts of the Table state which
 * defines the UI state
 */
export const useUiState = <RowType extends object>(
  initialState: UiState<RowType> | undefined,
  defaultState: UiState<RowType>,
  onChangeState: (newState: UiState<RowType>) => void,
): {
  uiState: UiState<RowType>;
  controller: UiStateController<RowType>;
} => {
  const [uiState, _setState] = useState<UiState<RowType>>({
    ...defaultState,
    ...initialState,
  });

  const setColumnWidths = useCallback(
    (newWidths: ColumnWidthInfo<RowType>[]) => {
      _setState((prevState) => {
        if (isEqual(prevState.columnWidths, newWidths)) return prevState;
        const newState = { ...prevState, columnWidths: newWidths };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setColumnOrder = useCallback(
    (newOrder: ColumnName<RowType>[]) => {
      _setState((prevState) => {
        if (isEqual(prevState.order, newOrder)) return prevState;
        const newState = { ...prevState, order: newOrder };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setHiddenColumns = useCallback(
    (newHiddenColumns: ColumnName<RowType>[]) => {
      _setState((prevState) => {
        if (isEqual(prevState.hiddenColumnNames, newHiddenColumns)) return prevState;
        const newState = { ...prevState, hiddenColumnNames: newHiddenColumns };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setSelectedRowIndex = useCallback(
    (rowIndex: number | undefined) => {
      _setState((prevState) => {
        if (isEqual(prevState.selectedRowIndex, rowIndex)) return prevState;
        const newState = { ...prevState, selectedRowIndex: rowIndex };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setFixedColumns = useCallback(
    (newFixedColumns: FixedColumnsInfo<RowType>) => {
      _setState((prevState) => {
        if (isEqual(prevState.fixedColumns, newFixedColumns)) return prevState;
        const newState = { ...prevState, fixedColumns: newFixedColumns };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setGroupingColumns = useCallback(
    (newGroupingColumns?: ColumnName<RowType>[]) => {
      _setState((prevState) => {
        if (isEqual(prevState.grouping, newGroupingColumns)) return prevState;
        const newState = { ...prevState, grouping: newGroupingColumns };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setSelectedRowsWithCheckbox = useCallback(
    (newSelectedRowsWithCheckbox?: (string | number)[]) => {
      _setState((prevState) => {
        if (isEqual(prevState.selectedRowsWithCheckbox, newSelectedRowsWithCheckbox)) return prevState;
        const newState = { ...prevState, selectedRowsWithCheckbox: newSelectedRowsWithCheckbox };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setState = useCallback(
    (newState: UiState<RowType>) => {
      _setState((prevState) => {
        if (isEqual(prevState, newState)) return prevState;
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const resetColumnWidths = useCallback(
    () => setColumnWidths(defaultState.columnWidths),
    [defaultState, setColumnWidths],
  );
  const resetFixedColumns = useCallback(
    () => setFixedColumns(defaultState.fixedColumns),
    [defaultState.fixedColumns, setFixedColumns],
  );
  const resetColumnOrder = useCallback(() => setColumnOrder(defaultState.order), [defaultState, setColumnOrder]);
  const resetHiddenColumns = useCallback(
    () => setHiddenColumns(defaultState.hiddenColumnNames),
    [defaultState, setHiddenColumns],
  );
  const resetSelectedRowIndex = useCallback(
    () => setSelectedRowIndex(defaultState.selectedRowIndex),
    [defaultState, setSelectedRowIndex],
  );
  const resetGroupingColumns = useCallback(
    () => setGroupingColumns(defaultState.grouping),
    [defaultState.grouping, setGroupingColumns],
  );
  const resetSelectedRowsWithCheckbox = useCallback(
    () => setSelectedRowsWithCheckbox(defaultState.selectedRowsWithCheckbox),
    [defaultState, setSelectedRowsWithCheckbox],
  );

  const resetState = useCallback(() => setState(defaultState), [setState, defaultState]);

  return {
    uiState,
    controller: useMemo(
      () => ({
        resetColumnOrder,
        resetColumnWidths,
        resetFixedColumns,
        resetHiddenColumns,
        resetSelectedRowIndex,
        resetGroupingColumns,
        resetSelectedRowsWithCheckbox,
        resetState,
        setColumnOrder,
        setColumnWidths,
        setFixedColumns,
        setHiddenColumns,
        setSelectedRowIndex,
        setGroupingColumns,
        setSelectedRowsWithCheckbox,
        setState,
      }),
      [
        resetColumnOrder,
        resetColumnWidths,
        resetFixedColumns,
        resetHiddenColumns,
        resetSelectedRowIndex,
        resetGroupingColumns,
        resetSelectedRowsWithCheckbox,
        resetState,
        setColumnOrder,
        setColumnWidths,
        setFixedColumns,
        setHiddenColumns,
        setSelectedRowIndex,
        setGroupingColumns,
        setSelectedRowsWithCheckbox,
        setState,
      ],
    ),
  };
};
