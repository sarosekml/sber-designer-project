import { useEffect } from 'react';

import { useEventApi, useEventApiListener, uuid } from '@sber-ibp/core';

import { getTableEventChannelId } from '../Table.utils';
import { TableState, TableStateController } from '../TableState';
import { TableStateControllerEvents, TableStateEvents } from '../TableState/TableState.events';

/**
 * Make table listen to `TableStateControllerEvents`, so user can change the state of the
 * table by sending this events using the same table code. (!) The event source id is calculated
 * basing on the table code using the special function `getTableEventChannelId`.
 */
export const useTableEventSubscription = <RowType extends object, Filter extends object>(
  tableState: TableState<RowType, Filter>,
  tableStateController: TableStateController<RowType, Filter>,
  tableCode: string | undefined,
) => {
  const areEventsAvailable = Boolean(tableCode);
  const listenerChannelId = tableCode ? getTableEventChannelId(tableCode, 'toTable') : uuid();
  const triggerChannelId = tableCode ? getTableEventChannelId(tableCode, 'fromTable') : uuid();

  const { trigger } = useEventApi<TableStateEvents<RowType, Filter>>(triggerChannelId);

  useEventApiListener<TableStateControllerEvents<RowType, Filter>>(
    (event) => {
      const { eventId, data } = event;
      switch (eventId) {
        case 'setState':
          return tableStateController.setState(data);
        case 'resetState':
          return tableStateController.resetState();

        // Cacheable state events
        case 'setPageSize':
          return tableStateController.setPageSize(data);
        case 'setCurrentPage':
          return tableStateController.setCurrentPage(data);
        case 'setFilters':
          return tableStateController.setFilters(data);
        case 'setSorting':
          return tableStateController.setSorting(data);

        case 'resetPageSize':
          return tableStateController.resetPageSize();
        case 'resetCurrentPage':
          return tableStateController.resetCurrentPage();
        case 'resetFilters':
          return tableStateController.resetFilters();
        case 'resetSorting':
          return tableStateController.resetSorting();

        // UI state events
        case 'setColumnOrder':
          return tableStateController.setColumnOrder(data);
        case 'setColumnWidths':
          return tableStateController.setColumnWidths(data);
        case 'setFixedColumns':
          return tableStateController.setFixedColumns(data);
        case 'setHiddenColumns':
          return tableStateController.setHiddenColumns(data);
        case 'setSelectedRowIndex':
          return tableStateController.setSelectedRowIndex(data);
        case 'setGroupingColumns':
          return tableStateController.setGroupingColumns(data);
        case 'setSelectedRowsWithCheckbox':
          return tableStateController.setSelectedRowsWithCheckbox(data);

        case 'resetColumnOrder':
          return tableStateController.resetColumnOrder();
        case 'resetColumnWidths':
          return tableStateController.resetColumnWidths();
        case 'resetHiddenColumns':
          return tableStateController.resetHiddenColumns();
        case 'resetSelectedRowIndex':
          return tableStateController.resetSelectedRowIndex();
        case 'resetFixedColumns':
          return tableStateController.resetFixedColumns();
        case 'resetGroupingColumns':
          return tableStateController.resetGroupingColumns();
        case 'resetSelectedRowsWithCheckbox':
          return tableStateController.resetSelectedRowsWithCheckbox();

        case 'requestState':
          return trigger('tableStateResponse', {
            requestId: event.data,
            tableState,
          });
        default:
          return;
      }
    },
    [tableState, tableStateController, trigger],
    listenerChannelId,
  );

  useEffect(() => {
    if (areEventsAvailable) {
      trigger('tableStateChanged', tableState);
    }
  }, [areEventsAvailable, tableState, trigger]);
};
