import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRerender } from '@sber-ibp/core';

import {
  HierarchicalTreeDataFetcherConfig,
  HierarchicalTreeNode,
  HierarchicalTreeProps,
  TreeNodeData,
} from '../HierarchicalTree.types';
import { createHierarchicalTreeMap, flattenTree, prepareHierarchicalTreeNode } from '../HierarchicalTree.utils';

export const useHierarchicalTreeActions = <T extends TreeNodeData>({
  dataFetcherConfig,
  dataFetcher,
  nodeIdentifierKey,
  columns,
}: Omit<HierarchicalTreeProps<T>, 'maxDepth'>) => {
  const [stateConfig, setStateConfig] = useState<HierarchicalTreeDataFetcherConfig>(dataFetcherConfig);
  const treeMap = useRef(createHierarchicalTreeMap<T>());
  const { triggerRerender, rerenderCounter } = useRerender();

  const flattenedNodes = useMemo(() => flattenTree(treeMap.current), [rerenderCounter]);
  const rowCount = flattenedNodes.length + 1;
  const columnCount = columns.length;

  // For the first loading
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }

    initialLoadRef.current = true;

    const getNodesLayerOne = async () => {
      try {
        const data: T[] = await dataFetcher(stateConfig);

        treeMap.current.clear();
        if (data.length > 0) {
          data.forEach((nodeData, index) => {
            const treeNode = prepareHierarchicalTreeNode({ index, nodeData, nodeIdentifierKey });
            treeMap.current.set(treeNode.uniqueId, treeNode);
          });
          triggerRerender();
        }
      } catch (error) {
        console.error('🔄 [ACTIONS] Error loading root data:', error);
      }
    };

    void getNodesLayerOne();
  }, []);

  const onSortColumn = useCallback(
    async (dataFetcherConfig: HierarchicalTreeDataFetcherConfig) => {
      const data = await dataFetcher(dataFetcherConfig);

      treeMap.current.clear();
      data.forEach((nodeData, index) => {
        const treeNode = prepareHierarchicalTreeNode({ index, nodeData, nodeIdentifierKey });
        treeMap.current.set(treeNode.uniqueId, treeNode);
      });

      setStateConfig(dataFetcherConfig);
    },
    [dataFetcher, nodeIdentifierKey],
  );

  const onNodeClick = useCallback(
    async (node: HierarchicalTreeNode<T>) => {

      if (node.expanded) {
        node.expanded = false;
        triggerRerender();
        return;
      }

      const data = await dataFetcher(stateConfig, node);
      node.children = createHierarchicalTreeMap();
      data.forEach((nodeData, index) => {
        const treeNode = prepareHierarchicalTreeNode({ index, node, nodeData, nodeIdentifierKey });
        node.children?.set(treeNode.uniqueId, treeNode);
      });

      node.expanded = true;
      triggerRerender();
    },
    [dataFetcher, nodeIdentifierKey, stateConfig, triggerRerender],
  );

  return useMemo(
    () => ({
      columnCount,
      flattenedNodes,
      onNodeClick,
      onSortColumn,
      rerenderCounter,
      rowCount,
      stateConfig,
    }),
    [flattenedNodes, onNodeClick, onSortColumn, stateConfig, rowCount, columnCount, rerenderCounter],
  );
};
