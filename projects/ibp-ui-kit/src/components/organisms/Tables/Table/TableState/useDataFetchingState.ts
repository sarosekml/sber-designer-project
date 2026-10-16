import { useCallback, useMemo, useState } from 'react';

import { isEqual } from '@sber-ibp/core';

import { Sorting } from '../TableProps';

import { DataFetchingState, DataFetchingStateController } from './TableState.types';

/**
 * Table component has two parts of the state:
 * - the one which defines the data fetching state
 * - the one which defines the ui state
 *
 * This hook provides the parts of the Table state which
 * defines the data fetching state
 */
export const useDataFetchingState = <RowType extends object, Filter extends object>(
  initialState: DataFetchingState<RowType, Filter> | undefined,
  defaultState: DataFetchingState<RowType, Filter>,
  onChangeState: (newState: DataFetchingState<RowType, Filter>) => void,
): {
  dataFetchingState: DataFetchingState<RowType, Filter>;
  controller: DataFetchingStateController<RowType, Filter>;
} => {
  const [dataFetchingState, _setState] = useState<DataFetchingState<RowType, Filter>>({
    ...defaultState,
    ...initialState,
  });

  const setCurrentPage = useCallback(
    (newPage: number) => {
      _setState((prevState) => {
        if (isEqual(prevState.currentPage, newPage)) return prevState;
        const newState = { ...prevState, currentPage: newPage };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setSorting = useCallback(
    (newSorting: Sorting<RowType>[]) => {
      _setState((prevState) => {
        if (isEqual(prevState.sorting, newSorting)) return prevState;
        const newState = { ...prevState, sorting: newSorting };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setFilters = useCallback(
    (newFilters?: Filter, resetCurrentPage = true) => {
      _setState((prevState) => {
        if (isEqual(prevState.filters, newFilters)) return prevState;
        const newState = {
          ...prevState,
          filters: newFilters,
          currentPage: resetCurrentPage ? 0 : prevState.currentPage,
        };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setPageSize = useCallback(
    (newPageSize: number | undefined, resetCurrentPage = true) => {
      _setState((prevState) => {
        if (isEqual(prevState.pageSize, newPageSize)) return prevState;
        const newState = {
          ...prevState,
          pageSize: newPageSize,
          currentPage: resetCurrentPage ? 0 : prevState.currentPage,
        };
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const setState = useCallback(
    (newState: DataFetchingState<RowType, Filter>) => {
      _setState((prevState) => {
        if (isEqual(prevState, newState)) return prevState;
        onChangeState(newState);
        return newState;
      });
    },
    [onChangeState],
  );

  const resetCurrentPage = useCallback(() => setCurrentPage(defaultState.currentPage), [defaultState, setCurrentPage]);
  const resetFilters = useCallback(() => setFilters(defaultState.filters), [defaultState, setFilters]);
  const resetPageSize = useCallback(() => setPageSize(defaultState.pageSize), [defaultState, setPageSize]);
  const resetSorting = useCallback(() => setSorting(defaultState.sorting), [defaultState, setSorting]);
  const resetState = useCallback(() => setState(defaultState), [defaultState, setState]);

  return {
    dataFetchingState,
    controller: useMemo(
      () => ({
        setState,
        setCurrentPage,
        setFilters,
        setPageSize,
        setSorting,
        resetState,
        resetCurrentPage,
        resetFilters,
        resetPageSize,
        resetSorting,
      }),
      [
        setState,
        setCurrentPage,
        setFilters,
        setPageSize,
        setSorting,
        resetState,
        resetCurrentPage,
        resetFilters,
        resetPageSize,
        resetSorting,
      ],
    ),
  };
};
