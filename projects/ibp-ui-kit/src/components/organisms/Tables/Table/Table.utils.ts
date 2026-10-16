import { Sorting } from '@devexpress/dx-react-grid';

import { SearchRequestDto } from '@sber-ibp/core';

import { DataFetchingState } from './TableState';

export const createSortingParams = (sortingState: Sorting[]) =>
  sortingState?.map((it) => `${it.direction === 'asc' ? '+' : '-'}${it.columnName}`).join(',');

export const prepareFetchingConfig = <RowType extends object, Filter extends object>({
  sorting,
  pageSize = 0,
  currentPage,
  filters,
}: DataFetchingState<RowType, Filter>): SearchRequestDto<Filter> => ({
  paging: {
    sort: createSortingParams(sorting),
    limit: pageSize,
    offset: currentPage * pageSize,
    returnCount: true,
    returnOnlyCount: false,
  },
  filters,
});

export const getTableEventChannelId = (tableCode: string, direction: 'toTable' | 'fromTable' = 'fromTable') =>
  `TableEventsChannel:${tableCode}:${direction}`;
