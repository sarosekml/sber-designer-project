import { DataTestIdProps } from '@/types';

export type HierarchicalTreeSortOrder = 'asc' | 'desc' | 'noDirection';

export interface HierarchicalTreeDataFetcherConfig {
  sortOrder: HierarchicalTreeSortOrder;
  sortField: string;
}

export interface TreeNodeData {
  isLeaf: boolean;
}

export interface HierarchicalTreeNode<T extends TreeNodeData> {
  nodeData: T;
  children?: Map<string, HierarchicalTreeNode<T>>;
  expanded?: boolean;
  level: number;
  name: string;
  sortOrder: HierarchicalTreeSortOrder;
  uniqueId: string;
}

export type HierarchicalTreeDataFetcher<T extends TreeNodeData> = (
  dataFetcherConfig: HierarchicalTreeDataFetcherConfig,
  node?: HierarchicalTreeNode<T>,
) => Promise<T[]>;

export interface HierarchicalTreeColumnConfig<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  width?: number;
}

export interface HierarchicalTreeSortNode {
  direction: HierarchicalTreeSortOrder;
  onSort: (dataFetcherConfig: HierarchicalTreeDataFetcherConfig) => void;
  sortable: boolean;
  sortField: string;
}

export interface HierarchicalTreeProps<T extends TreeNodeData> extends DataTestIdProps {
  dataFetcher: HierarchicalTreeDataFetcher<T>;
  maxDepth: number;
  columns: HierarchicalTreeColumnConfig<T>[];
  dataFetcherConfig: HierarchicalTreeDataFetcherConfig;
  nodeIdentifierKey: keyof T;
  onLeafClick?: (node: HierarchicalTreeNode<T>) => void;
}

export type HierarchicalTreeMap<T extends TreeNodeData> = Map<string, HierarchicalTreeNode<T>>;

export interface PrepareHierarchicalTreeProps<T extends TreeNodeData> {
  nodeData: T;
  index: number;
  nodeIdentifierKey: keyof T;
  node?: HierarchicalTreeNode<T>;
}
