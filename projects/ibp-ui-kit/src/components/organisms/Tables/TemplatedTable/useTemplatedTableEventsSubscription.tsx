import { useEffect, useMemo } from 'react';

import { SearchRequestDto, useEventApi, useEventApiListener } from '@sber-ibp/core';

import { TemplatedTableStateControllerEvents, TemplatedTableStateEvents } from './TemplatedTable.events';
import { getTemplatedTableEventChannelId } from './TemplatedTable.utils';

export interface UseTemplatedTableEventsSubscriptionProps<RowDataType extends object, Filter extends object> {
  tableCode?: string;
  isLoading: boolean;
  hasItems: boolean;
  onUpdateData: (config: SearchRequestDto<Filter>) => void;
  configState: SearchRequestDto<Filter> | undefined;
  updateRowWithIndex: (index: number, data: RowDataType) => void;
  addRow: (data: RowDataType) => void;
  removeRow: (index: number) => void;
}

const mockTableCode = '';

export const useTemplatedTableEventsSubscription = <
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
>({
  tableCode: optionalCode,
  isLoading,
  hasItems,
  configState,
  onUpdateData,
  updateRowWithIndex,
  addRow,
  removeRow,
}: UseTemplatedTableEventsSubscriptionProps<RowDataType, Filter>) => {
  type ListenerEventType = TemplatedTableStateControllerEvents<RowType, Filter, RowDataType>;

  const tableCode = optionalCode ?? mockTableCode;
  const areEventsAvailable = Boolean(optionalCode);
  const tableState = useMemo(
    () => ({
      hasItems,
      isLoading,
    }),
    [hasItems, isLoading],
  );

  const listenerChannelId = getTemplatedTableEventChannelId(tableCode);
  const triggerChannelId = getTemplatedTableEventChannelId(tableCode, 'fromTable');

  const { trigger } = useEventApi<TemplatedTableStateEvents>(triggerChannelId);

  useEventApiListener<ListenerEventType, 'updateTableRow'>(
    ({ data: { index, data } }) => updateRowWithIndex(index, data),
    [updateRowWithIndex],
    listenerChannelId,
    'updateTableRow',
  );
  useEventApiListener<ListenerEventType, 'addTableRow'>(
    ({ data }) => addRow(data),
    [addRow],
    listenerChannelId,
    'addTableRow',
  );
  useEventApiListener<ListenerEventType, 'removeTableRow'>(
    ({ data }) => removeRow(data),
    [removeRow],
    listenerChannelId,
    'removeTableRow',
  );
  useEventApiListener<ListenerEventType, 'requestState'>(
    ({ data: requestId }) =>
      trigger('tableStateResponse', {
        requestId,
        tableState,
      }),
    [tableState, trigger],
    listenerChannelId,
    'requestState',
  );
  useEventApiListener<ListenerEventType, 'refetchData'>(
    () => {
      if (!configState) return;
      void onUpdateData(configState);
    },
    [configState, onUpdateData],
    listenerChannelId,
    'refetchData',
  );

  useEffect(() => {
    if (areEventsAvailable) {
      trigger('tableStateChanged', tableState);
    }
  }, [areEventsAvailable, tableState, trigger]);
};
