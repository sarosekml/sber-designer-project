import React, { memo, useContext, useMemo } from 'react';
import { ColumnChooser } from '@devexpress/dx-react-grid-material-ui';
import { TableBody } from '@mui/material';

import { ColumnVisibilityManagerContext } from '../ColumnVisibilityManagerPlugin.context';

const isColumnChooserItem = (child: React.ReactNode): child is React.ReactElement<ColumnChooser.ItemProps> => {
  return React.isValidElement(child) && Boolean(child.props?.item?.column?.name);
};

const useChildrenComparator = (order?: string[]) =>
  useMemo(() => {
    if (!order) return undefined;
    const orderMap = new Map(order.map((name, index) => [name, index]));
    return (child1: React.ReactNode, child2: React.ReactNode) => {
      const order1 = orderMap.get(isColumnChooserItem(child1) ? child1.props.item.column.name : '') ?? Infinity;
      const order2 = orderMap.get(isColumnChooserItem(child2) ? child2.props.item.column.name : '') ?? Infinity;
      if (order1 > order2) {
        return 1;
      } else if (order1 < order2) {
        return -1;
      } else {
        return 0;
      }
    };
  }, [order]);

const useOrderedChildren = (children: React.ReactNode, order?: string[]) => {
  const comparator = useChildrenComparator(order);
  return useMemo(
    () => (comparator ? React.Children.toArray(children).sort(comparator) : children),
    [comparator, children],
  );
};

export const ColumnChooserContainer = memo(({ children }: ColumnChooser.ContainerProps) => {
  const { order } = useContext(ColumnVisibilityManagerContext);
  const orderedChildren = useOrderedChildren(children, order);
  return <TableBody>{orderedChildren}</TableBody>;
});
