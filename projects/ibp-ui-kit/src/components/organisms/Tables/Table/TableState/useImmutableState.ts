import { useCallback, useMemo, useRef } from 'react';

import { isEqual } from '@sber-ibp/core';

import { ImmutableState, ImmutableStateController, ScrollState, TableState } from './TableState.types';

/**
 * Table component has two parts of the state:
 * - the one which defines the data fetching state
 * - the one which defines the ui state
 *
 * This hook provides the parts of the Table state which
 * defines the data fetching state
 */
export const useImmutableState = <RowType extends object, Filter extends object>(
  initialState: ImmutableState<RowType> | undefined,
  defaultState: ImmutableState<RowType>,
  tableState: TableState<RowType, Filter>,
  onTableStateChanged?: (
    state: TableState<RowType, Filter>,
    prevState: TableState<RowType, Filter> | undefined,
  ) => void,
): {
  immutableState: ImmutableState<RowType>;
  controller: ImmutableStateController<RowType>;
} => {
  const immutableState = useMemo(
    () => ({
      ...defaultState,
      ...initialState,
    }),
    [],
  );

  const prevState = useRef(immutableState);

  const setScroll = useCallback(
    (scroll?: ScrollState) => {
      if (isEqual(prevState.current.scroll, scroll)) return;
      const newState = { ...prevState.current, scroll };
      onTableStateChanged?.({ ...tableState, ...newState }, tableState);
      prevState.current = newState;
      return newState;
    },
    [onTableStateChanged, tableState],
  );

  const resetScroll = useCallback(() => setScroll(defaultState.scroll), [defaultState, setScroll]);

  return {
    immutableState,
    controller: useMemo(
      () => ({
        setScroll,
        resetScroll,
      }),
      [setScroll],
    ),
  };
};
