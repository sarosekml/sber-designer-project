import React, { memo, useCallback, useMemo, useRef } from 'react';

import { TableSettingsCacheLoader, useInitialValueOnly, uuid } from '@sber-ibp/core';

import { FirstExistingValueController, useFirstExistingValue } from '@/utils';

import { defaultColumnWidth, Table } from '../Table';
import { TableState } from '../Table/TableState';

import { useValidateAndCombineSettingsData, useWithCachingConfig } from './CacheableTable.hooks';
import { CacheableTableProps } from './CacheableTable.types';
import { convertTableStateToSettings, hashString, wereCacheablePropsChanged } from './CacheableTable.utils';
import { TableSkeleton } from './CacheableTableSkeleton';
import { mockCacheLoader } from './defaultCacheLoaders';

const mockTableCode = '';

const CacheableTableComponent = <RowType extends object, Filter extends object>({
  tableCode,
  configurationVersion: configVersion = '1',
  cacheLoader: cacheHooksProvider,
  onTableStateChanged: onTableStateChangedCallback,
  onResetTableSettings,
  tryToKeepCacheEvenIncompatible,
  ...props
}: CacheableTableProps<RowType, Filter>) => {
  const isCachingDisabled = !tableCode || !cacheHooksProvider;
  /**
   * It allows us to use these hooks without threat to get react errors, because we get only the initial value,
   * so it won't be possible to directly change the hook in runtime.
   */
  const { useCacheQuery, useCacheMutation } = useInitialValueOnly(
    (cacheHooksProvider ?? mockCacheLoader) as TableSettingsCacheLoader<RowType, Filter>,
  );
  const [storeCache, { isFetching: isStoring }] = useCacheMutation(tableCode ?? mockTableCode);

  const [loadedCachedData, { isFetching }] = useCacheQuery(
    tableCode ?? mockTableCode,
    useMemo(
      () => ({
        skip: isCachingDisabled || isStoring,
      }),
      [isCachingDisabled, isStoring],
    ),
  );
  /**
   * This hooks prevents us from cache updates after the first cache is loaded.
   */
  const firstValCtrl = useRef<FirstExistingValueController>(null);
  const cachedData = useFirstExistingValue(loadedCachedData, firstValCtrl);
  const isLoading = isFetching && !cachedData;

  const cachedSettings = useValidateAndCombineSettingsData<RowType, Filter>({
    cachedConfig: cachedData,
    configVersion,
    currentColumnsConfig: props.columns,
    defaultColumnWidth:
      typeof props.columnsResizing === 'object'
        ? props.columnsResizing.width ?? defaultColumnWidth
        : defaultColumnWidth,
    tryToMerge: Boolean(tryToKeepCacheEvenIncompatible),
  });
  const initialState = useWithCachingConfig(cachedSettings, props);

  // On table state changed
  const onTableStateChanged = useCallback(
    (newState: TableState<RowType, Filter>, prevState: TableState<RowType, Filter> | undefined) => {
      // Don't pass initialization changes
      if (!prevState) return;

      onTableStateChangedCallback?.(newState, prevState);
      if (!isCachingDisabled && wereCacheablePropsChanged(newState, prevState, props.cachingConfig)) {
        const newSettings = convertTableStateToSettings(newState, configVersion);
        void storeCache(newSettings);
      }
    },
    [configVersion, isCachingDisabled, onTableStateChangedCallback, props.cachingConfig, storeCache],
  );

  const handleReset = useCallback(async () => {
    try {
      await storeCache({
        columns: [],
        currentPage: 0,
        version: uuid(),
      });
    } finally {
      onResetTableSettings?.();
      firstValCtrl.current?.resetValue();
    }
  }, [onResetTableSettings, storeCache]);

  const key = useMemo(() => hashString(JSON.stringify(cachedData) ?? ''), [cachedData]);

  return isLoading ? (
    <TableSkeleton tableCode={tableCode} />
  ) : (
    <Table
      {...props}
      key={key}
      tableCode={tableCode}
      initialState={initialState}
      onTableStateChanged={onTableStateChanged}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onResetTableSettings={handleReset}
    />
  );
};

export const CacheableTable = memo(CacheableTableComponent) as typeof CacheableTableComponent & {
  displayName: string;
};
CacheableTable.displayName = 'CacheableTable';
