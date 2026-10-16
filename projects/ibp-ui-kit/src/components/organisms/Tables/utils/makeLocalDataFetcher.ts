import { TableDataFetchCallback } from '../TemplatedTable';

export const makeLocalDataFetcher =
  <RowType extends object, Filter extends object>(items: RowType[]): TableDataFetchCallback<RowType, Filter> =>
  () =>
    Promise.resolve({
      items,
      listInfo: {
        count: items.length,
        limit: items.length,
        offset: 0,
      },
    });
