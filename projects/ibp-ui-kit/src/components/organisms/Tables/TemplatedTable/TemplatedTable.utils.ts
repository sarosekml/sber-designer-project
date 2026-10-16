import { useMemo } from 'react';

import { ListInfoType } from '@sber-ibp/core';

import { getTableEventChannelId } from '../Table';

import { RowDefinition } from './TemplatedTable.types';

export const getTemplatedTableEventChannelId = (
  tableCode: string,
  direction: 'toTable' | 'fromTable' = 'fromTable',
) => {
  return getTableEventChannelId(tableCode, direction) + ':templatedTable';
};

export const getListInfo = (count = 0, limit = 0, offset = 0): ListInfoType => ({ count, limit, offset });

export const useRowEventHandler = <RowDataType extends object, ReturnType>(
  items: RowDataType[] | undefined,
  onEvent: ((rowDefinition: RowDefinition<RowDataType>, ...args) => ReturnType) | undefined,
) =>
  useMemo(
    () =>
      onEvent
        ? (_row: unknown, selectedIndex: number, ...args) => {
            if (!items || !items[selectedIndex]) return;
            return onEvent(
              {
                data: items[selectedIndex],
                index: selectedIndex,
              },
              ...args,
            );
          }
        : undefined,
    [items, onEvent],
  );
