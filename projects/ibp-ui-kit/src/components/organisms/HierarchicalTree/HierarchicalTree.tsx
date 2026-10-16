import React, { memo, useCallback } from 'react';
import { Grid, GridCellProps } from 'react-virtualized';

import { Icon, SxBox } from '@/components/atoms';

import { treeHeaderHeight, treeRowHeight, useHierarchicalTree } from './controllers';
import {
  getHeaderCellStyles,
  getRawNodeCellStyles,
  getTreeNodeCellStyles,
  hierarchicalTreeStyles,
} from './HierarchicalTree.styles';
import { HierarchicalTreeProps, TreeNodeData } from './HierarchicalTree.types';
import { getCellValue, HierarchicalTreeSortingIcon } from './HierarchicalTree.utils';

const HierarchicalTreeComponent = <T extends TreeNodeData>({
  dataFetcher,
  maxDepth,
  columns,
  dataFetcherConfig,
  nodeIdentifierKey,
  dataTestId,
  onLeafClick,
}: HierarchicalTreeProps<T>) => {
  const {
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
  } = useHierarchicalTree({
    columns,
    dataFetcher,
    dataFetcherConfig,
    maxDepth,
    nodeIdentifierKey,
  });

  const renderHeaderCell = useCallback(
    ({ columnIndex, key, style, rowIndex }: GridCellProps) => {
      const column = columns[columnIndex];
      const columnWidth = getColumnWidth({ index: columnIndex });
      const headerCellStyles = getHeaderCellStyles(columnWidth);

      return (
        <SxBox key={key} sx={headerCellStyles} style={style} className="headerCell">
          <SxBox
            ref={(el: HTMLDivElement) => {
              if (rowIndex === 0) {
                headerCellRefs.current[columnIndex] = el;
              }
            }}
            className={'headerTitle'}
          >
            {column.title}
          </SxBox>
          <SxBox className={'headerActions'}>
            <HierarchicalTreeSortingIcon
              direction={stateConfig.sortOrder}
              onSort={onSortColumn}
              sortable={Boolean(column.sortable)}
              sortField={stateConfig.sortField}
            />
          </SxBox>
          <SxBox
            className={`resizeHandle ${isResizing ? 'active' : ''}`}
            onMouseDown={(e) => handleResizeStart(e, columnIndex)}
          />
        </SxBox>
      );
    },
    [
      columns,
      getColumnWidth,
      handleResizeStart,
      headerCellRefs,
      isResizing,
      onSortColumn,
      stateConfig.sortField,
      stateConfig.sortOrder,
    ],
  );

  const cellRenderer = useCallback(
    ({ columnIndex, rowIndex, key, style }: GridCellProps) => {
      // Only for header cells
      if (rowIndex === 0) {
        return renderHeaderCell({ columnIndex, key, rowIndex, style });
      }

      const node = flattenedNodes[rowIndex - 1];
      if (!node) return null;

      const isLeaf = maxDepth === node.level || node.nodeData.isLeaf;
      const columnWidth = getColumnWidth({ index: columnIndex });

      let cellStyles;
      if (columnIndex === 0) {
        cellStyles = getTreeNodeCellStyles(maxDepth === node.level, node.level - 1, node.level, columnWidth, isLeaf);
      } else {
        cellStyles = getRawNodeCellStyles(columnWidth);
      }

      return (
        <SxBox key={key} sx={cellStyles} style={style}>
          {/* Render column with tree */}
          {columnIndex === 0 ? (
            <SxBox
              className="treeNodeContent"
              onClick={(e) => {
                e.stopPropagation();

                if (isLeaf) {
                  onLeafClick?.(node);
                  return;
                }

                void onNodeClick(node);
              }}
            >
              <SxBox className="singleNodeLayerContainer">
                {!isLeaf && (
                  <SxBox className="treeNodeIconWrapper">
                    {node.expanded ? (
                      <Icon name={'ChevronDown'} size="sm" className="treeNodeIcon" />
                    ) : (
                      <Icon name={'ChevronRight'} size="sm" className="treeNodeIcon" />
                    )}
                  </SxBox>
                )}

                {isLeaf && <SxBox style={{ width: '24px' }} />}
                <SxBox className="treeNodeTitle">{node.name}</SxBox>
              </SxBox>
              <SxBox
                className={`resizeHandle ${isResizing ? 'active' : ''}`}
                onMouseDown={(e) => handleResizeStart(e, columnIndex)}
              />
            </SxBox>
          ) : isLeaf ? (
            getCellValue(node, columnIndex, columns)
          ) : null}
        </SxBox>
      );
    },
    [columns, flattenedNodes, getColumnWidth, maxDepth, onNodeClick, renderHeaderCell, onLeafClick],
  );

  return (
    <SxBox
      sx={hierarchicalTreeStyles}
      data-testid={`HierarchicalTree_${dataTestId}`}
      ref={gridContainerRef}
      className={isResizing ? 'resizing' : ''}
    >
      {gridWidth > 0 && gridHeight > 0 && (
        <Grid
          key={gridKey}
          width={gridWidth}
          height={gridHeight}
          rowCount={rowCount}
          columnCount={columnCount}
          rowHeight={({ index }) => (index === 0 ? measuredHeaderHeight ?? treeHeaderHeight : treeRowHeight)}
          columnWidth={getColumnWidth}
          cellRenderer={cellRenderer}
          overscanRowCount={10}
          overscanColumnCount={2}
        />
      )}
    </SxBox>
  );
};

export const HierarchicalTree = memo(HierarchicalTreeComponent) as typeof HierarchicalTreeComponent;
