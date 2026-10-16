import React, { memo, useCallback } from 'react';

import { uniqueId } from '@sber-ibp/core';

import { IconButton, IconName } from '@/components/atoms';

import {
  HierarchicalTreeColumnConfig,
  HierarchicalTreeNode,
  HierarchicalTreeSortNode,
  HierarchicalTreeSortOrder,
  PrepareHierarchicalTreeProps,
  TreeNodeData,
} from './HierarchicalTree.types';

const sortIconMap: Record<HierarchicalTreeSortOrder, IconName> = {
  asc: 'ArrowNarrowUp',
  desc: 'ArrowNarrowDown',
  noDirection: 'ArrowUpDown',
};

export const HierarchicalTreeSortingIcon = memo(
  ({ direction, sortField, onSort, sortable }: HierarchicalTreeSortNode) => {
    const onIconClick = useCallback(() => {
      if (direction === 'asc') return onSort({ sortField, sortOrder: 'desc' });
      if (direction === 'desc') return onSort({ sortField, sortOrder: 'noDirection' });
      return onSort({ sortField, sortOrder: 'asc' });
    }, [direction, onSort, sortField]);

    return sortable ? (
      <IconButton size={'sm'} name={sortIconMap[direction || 'noDirection']} onClick={onIconClick} />
    ) : null;
  },
);

export const prepareHierarchicalTreeNode = <T extends TreeNodeData>({
  node,
  index,
  nodeData,
  nodeIdentifierKey,
}: PrepareHierarchicalTreeProps<T>) => {
  const level = node ? node.level + 1 : 1;
  const id = uniqueId('tree_node_');
  
  const treeNode: HierarchicalTreeNode<T> = {
    expanded: false,
    level,
    name: nodeData[nodeIdentifierKey] ? String(nodeData[nodeIdentifierKey]) : `Node_${index}`,
    nodeData,
    uniqueId: id, 
    sortOrder: 'noDirection',
  };
  return treeNode;
};

export type HierarchicalTreeMap<T extends TreeNodeData> = Map<string, HierarchicalTreeNode<T>>;

export const createHierarchicalTreeMap = <T extends TreeNodeData>(): HierarchicalTreeMap<T> => {
  return new Map<string, HierarchicalTreeNode<T>>();
};

export const flattenTree = <T extends TreeNodeData>(
  treeMap: HierarchicalTreeMap<T>,
  depth = 0,
): HierarchicalTreeNode<T>[] => {
  let result: HierarchicalTreeNode<T>[] = [];
  treeMap.forEach((node) => {
    result.push(node);
    if (node.expanded && node.children) {
      result = result.concat(flattenTree(node.children, depth + 1));
    }
  });
  return result;
};

export const getCellValue = <T extends TreeNodeData>(
  node: HierarchicalTreeNode<T>,
  columnIndex: number,
  columns: HierarchicalTreeColumnConfig<T>[],
): React.ReactNode => {
  const column = columns[columnIndex];
  if (!column) return null;

  if (column.render) {
    return column.render(node.nodeData);
  }
  
  const value = node.nodeData[column.key];
  
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};
