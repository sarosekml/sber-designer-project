import { useEffect, useMemo, useState } from 'react';

import { triggerEvent, useEventApiListener, uuid } from '@sber-ibp/core';

import { getTableEventChannelId } from '../Table/Table.utils';
import { TableState } from '../Table/TableState';
import { TableStateControllerEvents, TableStateEvents } from '../Table/TableState/TableState.events';

const mockTableCode = '';

/**
 * The hook provides ability to obtain the current table state. The hook subscribes on
 * table events and request the initial state using 'requestState' event, then it subscribes
 * on all changes using table 'tableStateChanged' event.
 */
export const useTableState = <RowType extends object, Filter extends object>(
  tableCode: string | undefined,
): TableState<RowType, Filter> | undefined => {
  type TriggerEventType = TableStateControllerEvents<RowType, Filter>;
  type ListenerEventType = TableStateEvents<RowType, Filter>;

  const myRequestId = useMemo(() => uuid(), []);
  const [tableState, setTableState] = useState<TableState<RowType, Filter> | undefined>();
  const channelIdFromTable = getTableEventChannelId(tableCode ?? mockTableCode, 'fromTable');
  const channelIdToTable = getTableEventChannelId(tableCode ?? mockTableCode, 'toTable');

  useEventApiListener<ListenerEventType, 'tableStateResponse'>(
    ({ data: { tableState, requestId } }) => {
      if (requestId === myRequestId) {
        setTableState(tableState);
      }
    },
    [myRequestId],
    channelIdFromTable,
    'tableStateResponse',
  );

  useEventApiListener<ListenerEventType, 'tableStateChanged'>(
    ({ data: tableState }) => {
      setTableState(tableState);
    },
    [],
    channelIdFromTable,
    'tableStateChanged',
  );

  useEffect(() => {
    if (!tableCode) return;
    triggerEvent<TriggerEventType, 'requestState'>(channelIdToTable, 'requestState', myRequestId);
  }, [tableCode, myRequestId, channelIdToTable]);

  return tableState;
};
