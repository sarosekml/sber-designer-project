/* eslint-disable @typescript-eslint/no-namespace */
import { useMemo } from 'react';

import { TableSettingsCacheLoader } from '@sber-ibp/core';

import { getTableCache } from './CacheableTable.utils';

export const mockCacheLoader: TableSettingsCacheLoader = {
  useCacheQuery: () =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error Bypass of refetch type
    useMemo(
      () => [
        undefined,
        {
          isFetching: false,
          isError: false,
          refetch: () => Promise.resolve({}),
        },
      ],
      [],
    ),
  useCacheMutation: () =>
    useMemo(
      () => [
        () => Promise.resolve(),
        {
          isFetching: false,
          isError: false,
        },
      ],
      [],
    ),
};

export const localStorageCacheLoader: TableSettingsCacheLoader = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error Bypass of refetch type
  useCacheQuery: (tableCode, props) => {
    const reloadCounter = Number(localStorage.getItem(tableCode + 'resetTimestamp') ?? 0);
    return useMemo(() => {
      const storedSettings = getTableCache(tableCode);
      reloadCounter;
      return [
        !props?.skip ? storedSettings : undefined,
        {
          isFetching: false,
          isError: false,
          refetch: () => Promise.resolve({}),
        },
      ];
    }, [tableCode, props, reloadCounter]);
  },
  useCacheMutation: (tableCode) =>
    useMemo(
      () => [
        (cache) => {
          localStorage.setItem(tableCode, JSON.stringify(cache));
          localStorage.setItem(tableCode + 'resetTimestamp', `${Date.now()}`);
          return Promise.resolve();
        },
        {
          isFetching: false,
          isError: false,
        },
      ],
      [tableCode],
    ),
};
