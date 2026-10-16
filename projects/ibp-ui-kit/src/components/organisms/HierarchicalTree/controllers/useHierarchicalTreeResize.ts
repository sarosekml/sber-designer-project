import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBrowserEventsListener } from '@sber-ibp/core';

import { HierarchicalTreeDataFetcherConfig, HierarchicalTreeProps, TreeNodeData } from '../HierarchicalTree.types';

export const defaultTreeCellWidth = 200;
export const treeHeaderHeight = 48;
export const treeRowHeight = 48;

interface HierarchicalTreeResizeProps<T extends TreeNodeData> extends Pick<HierarchicalTreeProps<T>, 'columns'> {
  rerenderCounter: number;
  stateConfig: HierarchicalTreeDataFetcherConfig;
}

export const useHierarchicalTreeResize = <T extends TreeNodeData>({
  columns,
  rerenderCounter,
  stateConfig,
}: HierarchicalTreeResizeProps<T>) => {
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState<number | null>(null);
  const headerCellRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});


  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const startWidth = useRef(0);
  const resizingColumnIndex = useRef<number | null>(null);

  useEffect(() => {
    const initialWidths = new Map<number, number>();
    columns.forEach((column, index) => {
      initialWidths.set(index, column.width || defaultTreeCellWidth);
    });
    setColumnWidths(initialWidths);
  }, [columns]);

  const getColumnWidth = useCallback(
    ({ index }: { index: number }) => {


      if (columnWidths.has(index)) {
        return columnWidths.get(index)!;
      }

      return columns[index]?.width || defaultTreeCellWidth;
    },
    [columnWidths, columns],
  );

  /** Counting max height for header row */
  const measureHeaderHeight = useCallback(() => {
    const heights: number[] = [];
    Object.values(headerCellRefs.current).forEach((ref) => {
      if (ref) {
        heights.push(ref.scrollHeight);
      }
    });

    const maxHeight = heights.length > 0 ? Math.max(...heights) : treeHeaderHeight;
    setMeasuredHeaderHeight(Math.max(maxHeight, treeHeaderHeight));
  }, []);

  /** Resize update state controls */
  useEffect(() => {
    if (!gridContainerRef.current) return;
    setGridHeight(gridContainerRef.current.clientHeight);
  }, [rerenderCounter, stateConfig]);

  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      setGridWidth(container.clientWidth);
      setGridHeight(container.clientHeight);
      measureHeaderHeight();
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    updateSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [measureHeaderHeight]);

  useBrowserEventsListener(
    () => {
      if (gridContainerRef.current) {
        setGridWidth(gridContainerRef.current.clientWidth);
        setGridHeight(gridContainerRef.current.clientHeight);
      }
    },
    [],
    'resize',
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, columnIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      resizeStartX.current = e.clientX;
      startWidth.current = getColumnWidth({ index: columnIndex });
      resizingColumnIndex.current = columnIndex;
      setIsResizing(true);
    },
    [getColumnWidth],
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || resizingColumnIndex.current === null) return;

      const diffX = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, startWidth.current + diffX);

      setColumnWidths(prev => {
        const newWidths = new Map(prev);
        newWidths.set(resizingColumnIndex.current!, newWidth);
        return newWidths;
      });
    },
    [isResizing],
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizingColumnIndex.current = null;
    measureHeaderHeight();
  }, [measureHeaderHeight]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return useMemo(
    () => ({
      gridWidth,
      getColumnWidth,
      gridHeight,
      gridContainerRef,
      measuredHeaderHeight,
      headerCellRefs,
      isResizing,
      handleResizeStart,
      columnWidths: Array.from(columnWidths.values()),
    }),
    [
      gridWidth,
      getColumnWidth,
      gridHeight,
      measuredHeaderHeight,
      isResizing,
      handleResizeStart,
      columnWidths,
    ],
  );
};
