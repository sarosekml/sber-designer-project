import { useEffect, useRef } from 'react';

import { prepareFetchingConfig } from '../Table.utils';
import { TableInternalPlainModel } from '../TableProps';
import { TableState, useTableInternalState } from '../TableState';

import { useTableEventSubscription } from './useTableEventSubscription';
import { useValidateTable } from './useValidateTable';

const debouncingTime = 100;

/**
 * Table component has two parts of the state: the one which can be controlled outside (`controllableState`),
 * and the one which is only for internal use (`internalState`). This hook provides both of these parts
 * and the controller to control the second state. In the same time the hook internally
 * adjust subscription on the table controlling events and call all provided callbacks in response
 * to dedicated state changes:
 * - `onTableStateChanged` (if controllableState changed);
 * - `updateData` (if controllableState changed);
 * - `updateColumnsConfig` (if internalState changed).
 */
export const useTable = <RowType extends object, Filter extends object>(
  props: TableInternalPlainModel<RowType, Filter>,
) => {
  const { columns, isLoading, tableCode, onUiStateChanged, updateData, onTableStateChanged } = props;

  const { controller, tableState, uiState, dataFetchingState, dataFetchingStateController } =
    useTableInternalState(props);

  useTableEventSubscription(tableState, controller, tableCode);

  useValidateTable(
    {
      columns,
      skip: isLoading,
      uiState,
      dataFetchingState,
      dataFetchingStateController,
    },
    props,
  );

  // Subscribe on the fetching state
  const debounceTimeout = useRef<NodeJS.Timeout | undefined>();
  useEffect(() => {
    const fetchingConfig = prepareFetchingConfig(dataFetchingState);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      updateData?.(fetchingConfig);
    }, debouncingTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFetchingState, updateData]);

  // Subscribe on the ui state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onUiStateChanged?.(uiState), [uiState]);

  // Subscribe on overall state
  const previousTableState = useRef<TableState<RowType, Filter> | undefined>(undefined);
  useEffect(() => {
    onTableStateChanged?.(tableState, previousTableState.current);
    previousTableState.current = tableState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableState]);

  return {
    tableState,
    controller,
  };
};
