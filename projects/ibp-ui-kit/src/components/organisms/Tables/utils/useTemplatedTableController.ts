import { useMemo } from 'react';

import { useEventApi } from '@sber-ibp/core';

import { doNothing } from '@/utils';

import { TemplatedTableStateController, TemplatedTableStateControllerEvents } from '../TemplatedTable';
import { getTemplatedTableEventChannelId } from '../TemplatedTable/TemplatedTable.utils';

import { useTableController } from './useTableController';

const mockTableCode = '';
export const useTemplatedTableController = <
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
>(
  tableCode: string | undefined,
): TemplatedTableStateController<RowType, Filter, RowDataType> => {
  type TriggerEventType = TemplatedTableStateControllerEvents<RowType, Filter, RowDataType>;

  const baseController = useTableController<RowType, Filter>(tableCode);
  const channelId = getTemplatedTableEventChannelId(tableCode ?? mockTableCode);
  const { trigger } = useEventApi<TriggerEventType>(channelId);

  return useMemo(
    () => ({
      ...baseController,
      refetchData: tableCode ? () => trigger('refetchData', undefined) : doNothing,

      updateTableRow: tableCode
        ? (index: number, data: RowDataType) => trigger('updateTableRow', { index, data })
        : doNothing,

      addTableRow: tableCode ? (data: RowDataType) => trigger('addTableRow', data) : doNothing,

      removeTableRow: tableCode ? (index: number) => trigger('removeTableRow', index) : doNothing,
    }),
    [baseController, tableCode, trigger],
  );
};
