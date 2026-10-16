import { useCallback, useMemo } from 'react';

import { emptyArray, TableSettingsCacheLoader, useInitialValueOnly, uuid } from '@sber-ibp/core';

import { mockCacheLoader } from '../CacheableTable';
import { FilterPresetsContextData } from '../TableFilters/FilterPresets.context';

const mockTableCode = '';

export const useFilterPresetsController = <Filter extends object>(
  tableCode: string,
  cacheLoader?: TableSettingsCacheLoader<any, Filter>,
): FilterPresetsContextData<Filter> => {
  const filterPresetsCode = `${tableCode}_filter_presets`;
  const { useCacheQuery, useCacheMutation } = useInitialValueOnly(
    (cacheLoader ?? mockCacheLoader) as TableSettingsCacheLoader<any, Filter>,
  );

  const [storeCache, { isFetching: isStoring }] = useCacheMutation(filterPresetsCode ?? mockTableCode);

  const [loadedCachedData, { refetch }] = useCacheQuery(filterPresetsCode ?? mockTableCode, {
    skip: isStoring,
  });

  const storePresets = useCallback(
    async (presets) => {
      await storeCache({ filterPresets: presets, columns: emptyArray, currentPage: 0, version: uuid() }).then(() =>
        refetch(),
      );
    },
    [refetch, storeCache],
  );

  return useMemo(
    () => ({ presets: loadedCachedData?.filterPresets, storePresets }),
    [loadedCachedData?.filterPresets, storePresets],
  );
};
