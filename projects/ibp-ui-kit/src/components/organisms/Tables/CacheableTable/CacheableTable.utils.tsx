import { isEqual, SortingDirection, TableSettings } from '@sber-ibp/core';

import { ColumnName } from '../Table/TableProps';
import { TableState } from '../Table/TableState';

import { CachingProps, defaultCachingProps } from './CacheableTable.types';

const removeNonCacheableProps = <RowType extends object, Filter extends object>(
  state: TableState<RowType, Filter>,
  cachingConfig: CachingProps = defaultCachingProps,
): Partial<TableState<RowType, Filter>> => {
  type StateKey = keyof TableState<RowType, Filter>;
  const objectMap = new Map<StateKey, TableState<RowType, Filter>[StateKey]>();
  for (const key in state) {
    if (key in state && cachingConfig[key]) {
      objectMap.set(key as StateKey, state[key]);
    }
  }
  return Object.fromEntries(objectMap);
};

export const wereCacheablePropsChanged = <RowType extends object, Filter extends object>(
  state: TableState<RowType, Filter>,
  prevState: TableState<RowType, Filter>,
  cachingConfig: CachingProps | undefined,
): boolean => {
  if (!prevState) return false;
  if (state === prevState) return false;
  const filteredState = removeNonCacheableProps(state, cachingConfig);
  const filteredPrevState = removeNonCacheableProps(prevState, cachingConfig);

  return !isEqual(filteredState, filteredPrevState);
};

export const convertTableStateToSettings = <RowType extends object, Filter extends object>(
  {
    columnWidths,
    hiddenColumnNames,
    order,
    filters,
    sorting,
    pageSize,
    currentPage,
    fixedColumns,
    grouping,
    scroll,
  }: TableState<RowType, Filter>,
  version: string,
): TableSettings<RowType, Filter> => {
  const hiddenColumns = new Set(hiddenColumnNames);
  const widthMap = new Map<ColumnName<RowType>, string | number>();
  const sortingMap = new Map<ColumnName<RowType>, SortingDirection>();
  for (const { columnName, width } of columnWidths) {
    widthMap.set(columnName, width);
  }

  if (sorting) {
    for (const { columnName, direction } of sorting) {
      sortingMap.set(columnName, direction);
    }
  }

  return {
    columns: order.map((name) => ({
      isHidden: hiddenColumns.has(name) ? true : undefined,
      name,
      sortingDirection: sortingMap.get(name),
      width: widthMap.get(name) ?? 100,
      fixed: fixedColumns.get(name),
    })),
    currentPage,
    filters,
    pageSize,
    version,
    grouping,
    scroll,
  };
};

export const convertSettingToTableState = <RowType extends object, Filter extends object>({
  columns,
  pageSize,
  filters,
  currentPage,
  selectedRowIndex,
  grouping,
  scroll,
}: TableSettings<RowType, Filter>): TableState<RowType, Filter> => {
  const sorting = columns
    .filter(({ sortingDirection }) => Boolean(sortingDirection))
    .map(({ name, sortingDirection }) => ({ columnName: name, direction: sortingDirection ?? 'asc' }));

  const fixedColumns = new Map(columns.filter((item) => item.fixed).map(({ name, fixed }) => [name, fixed]));

  return {
    selectedRowIndex,
    columnWidths: columns.map(({ name, width }) => ({ columnName: name, width })),
    currentPage,
    filters,
    hiddenColumnNames: columns.filter(({ isHidden }) => isHidden).map(({ name }) => name),
    order: columns.map(({ name }) => name),
    pageSize,
    sorting,
    fixedColumns,
    grouping,
    scroll,
  };
};

export const getTableCache = <RowType extends object, Filter extends object>(
  tableCode: string,
): TableSettings<RowType, Filter> | undefined => {
  const data = localStorage.getItem(tableCode);
  if (!data) return;
  return JSON.parse(data);
};

export const hashString = (str: string, seed = 0x811c9dc5): string => {
  let i: number,
    l: number,
    hval = seed & 0x7fffffff;
  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return (hval >>> 0).toString(16);
};
