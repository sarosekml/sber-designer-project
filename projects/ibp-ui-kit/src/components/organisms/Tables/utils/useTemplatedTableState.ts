import { useCallback, useEffect, useMemo, useState } from 'react';

import { Subscriber, triggerEvent, useEventApiListener, uuid } from '@sber-ibp/core';

import {
  getTemplatedTableEventChannelId,
  TemplatedTableState,
  TemplatedTableStateControllerEvents,
  TemplatedTableStateEvents,
  TemplatedTableStatePart,
} from '../TemplatedTable';

import { useTableState } from './useTableState';

const mockTableCode = '';

/**
 * The hook provides ability to obtain the current table state. The hook subscribes on
 * table events and request the initial state using 'requestState' event, then it subscribes
 * on all changes using table 'tableStateChanged' event.
 */
export const useTemplateTableState = <RowType extends object, Filter extends object>(tableCode: string | undefined) => {
  type TriggerEventType = TemplatedTableStateControllerEvents<RowType, Filter>;
  const baseTableState = useTableState<RowType, Filter>(tableCode);
  const myRequestId = useMemo(() => uuid(), []);
  const [tableStatePart, setTableStatePart] = useState<TemplatedTableStatePart | undefined>();
  const channelIdFromTable = getTemplatedTableEventChannelId(tableCode ?? mockTableCode, 'fromTable');
  const channelIdToTable = getTemplatedTableEventChannelId(tableCode ?? mockTableCode, 'toTable');

  useEventApiListener<TemplatedTableStateEvents, 'tableStateResponse'>(
    ({ data: { tableState, requestId } }) => {
      if (requestId === myRequestId) {
        setTableStatePart(tableState);
      }
    },
    [myRequestId],
    channelIdFromTable,
    'tableStateResponse',
  );

  useEventApiListener<TemplatedTableStateEvents, 'tableStateChanged'>(
    ({ data: tableState }) => setTableStatePart(tableState),
    [],
    channelIdFromTable,
    'tableStateChanged',
  );

  useEffect(() => {
    if (!tableCode) return;
    triggerEvent<TriggerEventType, 'requestState'>(channelIdToTable, 'requestState', myRequestId);
  }, [tableCode, myRequestId, channelIdToTable]);

  return useMemo<TemplatedTableState<RowType, Filter> | undefined>(
    () => (baseTableState && tableStatePart ? { ...baseTableState, ...tableStatePart } : undefined),
    [baseTableState, tableStatePart],
  );
};
