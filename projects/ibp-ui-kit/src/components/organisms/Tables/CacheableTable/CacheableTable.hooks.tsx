import { useMemo } from 'react';

import { ColumnName, TableColumn, TableSettings } from '@sber-ibp/core';

import { ColumnsConfig, DefaultStateProps, getDefaultState } from '../Table';
import { TableState } from '../Table/TableState';

import { CachingProps, defaultCachingProps } from './CacheableTable.types';
import { convertSettingToTableState } from './CacheableTable.utils';

interface ValidatedCacheDataHookProps<RowType extends object, Filter extends object> {
  cachedConfig: TableSettings<RowType, Filter> | undefined;
  configVersion: string | undefined;
  currentColumnsConfig: ColumnsConfig<RowType>;
  defaultColumnWidth: number;
  tryToMerge: boolean;
}

export const useValidateAndCombineSettingsData = <RowType extends object, Filter extends object>({
  cachedConfig,
  configVersion,
  currentColumnsConfig,
  defaultColumnWidth,
  tryToMerge,
}: ValidatedCacheDataHookProps<RowType, Filter>): TableSettings<RowType, Filter> | undefined =>
  useMemo(() => {
    if (!cachedConfig || configVersion !== cachedConfig.version) return undefined;
    // Compare column names
    const requiredColumnNames = new Set(currentColumnsConfig.map((col) => col.name));
    const columnsFromSettings = new Set(cachedConfig.columns.map((col) => col.name));

    const newColumns = Array.from(requiredColumnNames).filter((col) => !columnsFromSettings.has(col));
    const deletedColumns = Array.from(columnsFromSettings).filter((col) => !requiredColumnNames.has(col));
    const columnsAreCompatible = newColumns.length === 0 && deletedColumns.length === 0;

    if (columnsAreCompatible) {
      return cachedConfig;
    } else if (tryToMerge) {
      const deletedColumnsSet = new Set(deletedColumns);
      const orderMap = new Map<ColumnName<RowType>, number>();
      const cachedColumnsMap = new Map(
        cachedConfig.columns
          .filter((col) => !deletedColumnsSet.has(col.name))
          .map((it, index) => {
            // put order index from the cache to the map for final sorting
            orderMap.set(it.name, index);
            return [it.name, it];
          }),
      );

      // Goes along the relevant columns and get data if exists from the cache
      const unsortedColumns: TableColumn<RowType>[] = currentColumnsConfig.map((it, index) => {
        if (!orderMap.has(it.name)) {
          // put order index if not exist in the cache to the map for final sorting
          orderMap.set(it.name, index);
        }
        return (
          cachedColumnsMap.get(it.name) ?? {
            name: it.name,
            width: it.width ?? defaultColumnWidth,
            isHidden: it.hidden,
            fixed: it.fixed,
            sortingDirection: it.sortingDirection,
          }
        );
      });

      // Comparator based on the cache and config indexes. The case with "?? 0" generally is impossible
      const compare = (a: TableColumn<RowType>, b: TableColumn<RowType>): number => {
        const ai = orderMap.get(a.name) ?? 0;
        const bi = orderMap.get(b.name) ?? 0;
        return ai - bi;
      };

      return {
        ...cachedConfig,
        // Sort columns by cache and config order
        columns: unsortedColumns.sort(compare),
        // Remove outdated columnNames
        grouping: cachedConfig.grouping?.filter((col) => !deletedColumnsSet.has(col)),
      };
    }
    console.warn(
      'Сached settings will be ignored. Settings from the cache have the same version number as required, but have incompatible list of columns! Please verify the configuration version.' +
        (newColumns.length > 0 ? ` New columns: ${newColumns.join(', ')}.` : '') +
        (deletedColumns.length > 0 ? ` Deleted columns: ${deletedColumns.join(', ')}.` : ''),
    );

    return undefined;
  }, [cachedConfig, configVersion, currentColumnsConfig, defaultColumnWidth, tryToMerge]);

export const useWithCachingConfig = <RowType extends object, Filter extends object>(
  settings: TableSettings<RowType, Filter> | undefined,
  props: DefaultStateProps<RowType, Filter> & { cachingConfig?: CachingProps },
) =>
  useMemo(() => {
    type CachingKey = keyof TableState<RowType, Filter>;
    if (!settings) return undefined;
    const data = convertSettingToTableState<RowType, Filter>(settings);

    const cachingConfig = props.cachingConfig ?? defaultCachingProps;
    const defaultState = getDefaultState(props);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultMap = new Map<CachingKey, any>();
    for (const key in data) {
      /** @TODO remove backward compatibility in the following iterations */
      const cachingKey = key as CachingKey | 'fixed';
      const cacheAttr = (cachingKey === 'fixed' ? 'fixedColumns' : key) as CachingKey;
      resultMap.set(cacheAttr, cachingConfig[cachingKey] ? data[cacheAttr] : defaultState[cacheAttr]);
    }
    return Object.fromEntries(resultMap) as TableState<RowType, Filter>;
  }, [props, settings]);
