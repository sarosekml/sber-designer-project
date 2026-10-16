import React, { memo, useCallback } from 'react';
import { TableColumnReordering } from '@devexpress/dx-react-grid-material-ui';

import { ColumnName } from '../../TableProps';

interface Props<RowData extends object> {
  order: ColumnName<RowData>[];
  staticOrderColumns?: Map<ColumnName<RowData>, number>;
  setOrder: (order: ColumnName<RowData>[]) => void;
}

const ColumnReorderingPluginComponent = <RowData extends object>({
  setOrder,
  order,
  staticOrderColumns = new Map(),
}: Props<RowData>) => {
  const onOrderChange = useCallback(
    (order: string[]) => {
      const newOrder = order.filter((it) => !staticOrderColumns.has(it as ColumnName<RowData>));
      const staticPares = Array.from(staticOrderColumns.entries()).sort(([, indA], [, indexB]) => indA - indexB);
      for (const [column, index] of staticPares) {
        newOrder.splice(index, 0, column);
      }
      setOrder(newOrder as ColumnName<RowData>[]);
    },
    [setOrder, staticOrderColumns],
  );
  return <TableColumnReordering key="Reordering plugin 2" order={order} onOrderChange={onOrderChange} />;
};

export const ColumnReorderingPlugin = memo(
  ColumnReorderingPluginComponent,
) as typeof ColumnReorderingPluginComponent & {
  displayName: string;
};
ColumnReorderingPlugin.displayName = 'ColumnReorderingPlugin';
