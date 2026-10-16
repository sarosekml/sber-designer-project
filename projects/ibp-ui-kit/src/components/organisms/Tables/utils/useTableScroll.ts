import { useCallback } from 'react';

import { useEventApi, useEventApiListener } from '@sber-ibp/core';

import { ScrollEvents } from '../Table/components/TableContainer/TableContainer.types';
import { makeScrollEventChannel } from '../Table/components/TableContainer/TableContainer.utils';
import { ScrollState } from '../Table/TableState';

const mockTableCode = '';

/**
 * The hook provides ability to obtain and control the current table scroll
 */
export const useTableScroll = <RowType extends object, Filter extends object>(
  tableCode: string,
  cb?: (scrollState?: ScrollState) => void,
) => {
  const { trigger } = useEventApi<ScrollEvents>(makeScrollEventChannel(tableCode ?? mockTableCode));

  useEventApiListener<ScrollEvents, 'currentState'>(
    ({ data }) => {
      cb?.(data);
    },
    [cb],
    makeScrollEventChannel(tableCode ?? mockTableCode),
    'currentState',
  );

  const setScroll = useCallback(
    (scrollState?: ScrollState) => {
      if (scrollState) {
        return trigger('change', scrollState);
      }
    },
    [trigger],
  );

  return { setScroll };
};
