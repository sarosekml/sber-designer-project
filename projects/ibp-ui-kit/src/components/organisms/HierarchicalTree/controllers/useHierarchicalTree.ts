import { useMemo } from 'react';

import { HierarchicalTreeProps, TreeNodeData } from '../HierarchicalTree.types';

import { useHierarchicalTreeActions } from './useHierarchicalTreeActions';
import { useHierarchicalTreeResize } from './useHierarchicalTreeResize';

export const useHierarchicalTree = <T extends TreeNodeData>({
  dataFetcherConfig,
  dataFetcher,
  nodeIdentifierKey,
  columns,
}: HierarchicalTreeProps<T>) => {
  const { stateConfig, rerenderCounter, onSortColumn, onNodeClick, flattenedNodes, rowCount, columnCount } =
    useHierarchicalTreeActions({
      columns,
      dataFetcher,
      dataFetcherConfig,
      nodeIdentifierKey,
    });
  const {
    gridWidth,
    getColumnWidth,
    gridHeight,
    gridContainerRef,
    measuredHeaderHeight,
    headerCellRefs,
    isResizing,
    handleResizeStart,
    columnWidths,
  } = useHierarchicalTreeResize({ columns, rerenderCounter, stateConfig });

  const gridKey = useMemo(() => {
    const totalColumnsWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    
    return `grid-${rerenderCounter}-${stateConfig.sortOrder}-${gridWidth}-${measuredHeaderHeight}-${totalColumnsWidth}`;
  }, [rerenderCounter, stateConfig, gridWidth, columnWidths, measuredHeaderHeight]);

  return useMemo(
    () => ({
      columnCount,
      flattenedNodes,
      getColumnWidth,
      gridContainerRef,
      gridHeight,
      gridKey,
      gridWidth,
      handleResizeStart,
      onNodeClick,
      headerCellRefs,
      onSortColumn,
      isResizing,
      stateConfig,
      measuredHeaderHeight,
      rowCount,
    }),
    [
      onSortColumn,
      onNodeClick,
      stateConfig,
      flattenedNodes,
      rowCount,
      columnCount,
      gridWidth,
      getColumnWidth,
      gridHeight,
      gridContainerRef,
      gridKey,
      isResizing,
      handleResizeStart,
      measuredHeaderHeight,
      headerCellRefs,
    ],
  );
};
