import { TableSettingsCacheLoader } from '@sber-ibp/core';

import { TableProps } from '../Table';
import { TableState } from '../Table/TableState';

/** @deprecated Use 'fixedColumns` @todo remove this functional in the next iterations */
type DeprecatedCachingProps = Partial<Record<'fixed', boolean>>;
export type CachingProps = Partial<Record<keyof TableState<object, object> | 'fixed', boolean>> &
  DeprecatedCachingProps;

export const defaultCachingProps: CachingProps = {
  currentPage: true,
  pageSize: true,
  filters: true,
  sorting: true,
  columnWidths: true,
  hiddenColumnNames: true,
  order: true,
  selectedRowIndex: false,
  fixedColumns: false,
  scroll: false,
};

export interface CacheableTableProps<RowType extends object, Filter extends object>
  extends Omit<TableProps<RowType, Filter>, 'initialState'> {
  /**
   * The configuration version defines the relevant version
   * of the configuration to use. In case the version of
   * the configuration from the server is not compatible
   * with the specified version we ignore this configuration.
   */
  configurationVersion?: string;
  /**
   * (!) To use the table with a cacheProvider you should define tableCode.
   */
  cacheLoader?: TableSettingsCacheLoader;
  /**
   * Defines which parameters of the state should be stored/queries via cache loader
   * @default undefined - all parameters are cached except filterPresets.
   * To enable filterPresets caching you must override the cachingConfig.
   */
  cachingConfig?: CachingProps;
  /**
   * (!Experimental feature!) Makes cache comparator try to merge cache config and the current columns definition
   * This behavior will be removed once prove reliability and defined as default
   * @default false
   */
  tryToKeepCacheEvenIncompatible?: boolean;
}

export type TableConfig<RowType extends object> = Pick<
  CacheableTableProps<RowType, object>,
  'cachingConfig' | 'columns' | 'configurationVersion'
>;
