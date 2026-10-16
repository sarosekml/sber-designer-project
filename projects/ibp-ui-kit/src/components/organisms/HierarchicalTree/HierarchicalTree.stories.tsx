import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { SxBox } from '@/components/atoms';

import { HierarchicalTree } from './HierarchicalTree';
import {
  HierarchicalTreeColumnConfig,
  HierarchicalTreeDataFetcher,
  HierarchicalTreeDataFetcherConfig,
  HierarchicalTreeNode,
  TreeNodeData,
} from './HierarchicalTree.types';

interface DataTestType extends TreeNodeData{
  name: string;
  value1: string;
  value2: string;
  value3: string;
  value4: string;
  level?: number;
}

const columns: HierarchicalTreeColumnConfig<DataTestType>[] = [
  {
    key: 'name',
    title: 'Название тестовой сущности очень длинное и тестовое',
    sortable: true,
    render: (item: DataTestType): React.ReactNode => {
      return <div>{item.name}</div>;
    },
    width: 600,
  },
  {
    key: 'value1',
    title: 'Value 1',
    sortable: false,
    render: (item: DataTestType): React.ReactNode => {
      return <div>{item.value1}</div>;
    },
    width: 200,
  },
  {
    key: 'value2',
    title: 'Value 2',
    sortable: false,
    render: (item: DataTestType): React.ReactNode => {
      return <div>{item.value2}</div>;
    },
    width: 150,
  },
  {
    key: 'value3',
    title: 'Value 3',
    sortable: false,
    render: (item: DataTestType): React.ReactNode => {
      return <div>{item.value3}</div>;
    },
    width: 200,
  },
  {
    key: 'value4',
    title: 'Value 4',
    sortable: false,
    render: (item: DataTestType): React.ReactNode => {
      return <div>{item.value4}</div>;
    },
    width: 200,
  },
];

const dataFetcherTwoLevels: HierarchicalTreeDataFetcher<DataTestType> = (
  config: HierarchicalTreeDataFetcherConfig,
  node?: HierarchicalTreeNode<DataTestType>,
) => {
  if (node) {
    const parentLevel = node?.nodeData?.level || 1;
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const data: DataTestType[] = [
          {
            name: `Дочерний элемент 1 (уровень ${parentLevel + 1})`,
            value1: 'value1_child_1',
            value2: 'value2_child_1',
            value3: 'value3_child_1',
            value4: 'value4_child_1',
            level: parentLevel + 1,
            isLeaf: true,
          },
          {
            name: `Дочерний элемент 2 (уровень ${parentLevel + 1})`,
            value1: 'value1_child_2',
            value2: 'value2_child_2',
            value3: 'value3_child_2',
            value4: 'value4_child_2',
            level: parentLevel + 1,
            isLeaf: true,
          },
          {
            name: `Дочерний элемент 3 (уровень ${parentLevel + 1})`,
            value1: 'value1_child_3',
            value2: 'value2_child_3',
            value3: 'value3_child_3',
            value4: 'value4_child_3',
            level: parentLevel + 1,
            isLeaf: true,
          },
        ];
        clearTimeout(timer);
        resolve(data);
      }, 500);
    });
  } else {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const data: DataTestType[] = [
          { 
            name: 'Корневой элемент 1', 
            value1: 'value1_root_1', 
            value2: 'value2_root_1', 
            value3: 'value3_root_1', 
            value4: 'value4_root_1',
            level: 1,
            isLeaf: false,
          },
          { 
            name: 'Корневой элемент 2', 
            value1: 'value1_root_2', 
            value2: 'value2_root_2', 
            value3: 'value3_root_2', 
            value4: 'value4_root_2',
            level: 1,
            isLeaf: false,
          },
          { 
            name: 'Корневой элемент 3', 
            value1: 'value1_root_3', 
            value2: 'value2_root_3', 
            value3: 'value3_root_3', 
            value4: 'value4_root_3',
            level: 1,
            isLeaf: false,
          },
        ];
        clearTimeout(timer);
        resolve(data);
      }, 500);
    });
  }
};

const dataFetcherDeep: HierarchicalTreeDataFetcher<DataTestType> = (
  config: HierarchicalTreeDataFetcherConfig,
  node?: HierarchicalTreeNode<DataTestType>,
) => {
  if (node) {
    const parentLevel = node?.nodeData?.level || 1;
    const isLeafLevel = parentLevel >= 3;
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const data: DataTestType[] = [
          {
            name: `Элемент уровня ${parentLevel + 1} - 1`,
            value1: `value1_l${parentLevel + 1}_1`,
            value2: `value2_l${parentLevel + 1}_1`,
            value3: `value3_l${parentLevel + 1}_1`,
            value4: `value4_l${parentLevel + 1}_1`,
            level: parentLevel + 1,
            isLeaf: isLeafLevel,
          },
          {
            name: `Элемент уровня ${parentLevel + 1} - 2`,
            value1: `value1_l${parentLevel + 1}_2`,
            value2: `value2_l${parentLevel + 1}_2`,
            value3: `value3_l${parentLevel + 1}_2`,
            value4: `value4_l${parentLevel + 1}_2`,
            level: parentLevel + 1,
            isLeaf: isLeafLevel,
          },
          {
            name: `Элемент уровня ${parentLevel + 1} - 3`,
            value1: `value1_l${parentLevel + 1}_3`,
            value2: `value2_l${parentLevel + 1}_3`,
            value3: `value3_l${parentLevel + 1}_3`,
            value4: `value4_l${parentLevel + 1}_3`,
            level: parentLevel + 1,
            isLeaf: isLeafLevel,
          },
        ];
        clearTimeout(timer);
        resolve(data);
      }, 300);
    });
  } else {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const data: DataTestType[] = [
          { 
            name: 'Корневой узел 1', 
            value1: 'value1_root_1', 
            value2: 'value2_root_1', 
            value3: 'value3_root_1', 
            value4: 'value4_root_1',
            level: 1,
            isLeaf: false,
          },
          { 
            name: 'Корневой узел 2', 
            value1: 'value1_root_2', 
            value2: 'value2_root_2', 
            value3: 'value3_root_2', 
            value4: 'value4_root_2',
            level: 1,
            isLeaf: false,
          },
          { 
            name: 'Корневой узел 3', 
            value1: 'value1_root_3', 
            value2: 'value2_root_3', 
            value3: 'value3_root_3', 
            value4: 'value4_root_3',
            level: 1,
            isLeaf: false,
          },
        ];
        clearTimeout(timer);
        resolve(data);
      }, 300);
    });
  }
};

const dataFetcherMixed: HierarchicalTreeDataFetcher<DataTestType> = (
  config: HierarchicalTreeDataFetcherConfig,
  node?: HierarchicalTreeNode<DataTestType>,
) => {
  if (node) {
    const parentLevel = node?.nodeData?.level || 1;
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const data: DataTestType[] = [
          {
            name: `Дочерняя нода с детьми (уровень ${parentLevel + 1})`,
            value1: 'value1_with_children',
            value2: 'value2_with_children',
            value3: 'value3_with_children',
            value4: 'value4_with_children',
            level: parentLevel + 1,
            isLeaf: false,
          },
          {
            name: `Дочерний лист 1 (уровень ${parentLevel + 1})`,
            value1: 'value1_leaf_1',
            value2: 'value2_leaf_1',
            value3: 'value3_leaf_1',
            value4: 'value4_leaf_1',
            level: parentLevel + 1,
            isLeaf: true,
          },
          {
            name: `Дочерний лист 2 (уровень ${parentLevel + 1})`,
            value1: 'value1_leaf_2',
            value2: 'value2_leaf_2',
            value3: 'value3_leaf_2',
            value4: 'value4_leaf_2',
            level: parentLevel + 1,
            isLeaf: true,
          },
        ];
        clearTimeout(timer);
        resolve(data);
      }, 400);
    });
  } else {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const data: DataTestType[] = [
          { 
            name: 'Основная группа 1', 
            value1: 'value1_group_1', 
            value2: 'value2_group_1', 
            value3: 'value3_group_1', 
            value4: 'value4_group_1',
            level: 1,
            isLeaf: false,
          },
          { 
            name: 'Основная группа 2', 
            value1: 'value1_group_2', 
            value2: 'value2_group_2', 
            value3: 'value3_group_2', 
            value4: 'value4_group_2',
            level: 1,
            isLeaf: false,
          },
          { 
            name: 'Основной лист', 
            value1: 'value1_leaf_root', 
            value2: 'value2_leaf_root', 
            value3: 'value3_leaf_root', 
            value4: 'value4_leaf_root',
            level: 1,
            isLeaf: true,
          },
        ];
        clearTimeout(timer);
        resolve(data);
      }, 400);
    });
  }
};

export default {
  title: 'Organisms/HierarchicalTree',
  component: HierarchicalTree,
  argTypes: {
    maxDepth: { control: 'number' },
  },
}as Meta<typeof HierarchicalTree<DataTestType>>;

const Template: StoryFn<typeof HierarchicalTree<DataTestType>> = (args) => {
  return (
    <SxBox style={{ padding: 0, margin: 0, width: '100%', height: '90vh' }}>
      <HierarchicalTree
        {...args}
        dataTestId="hierarchical-tree"
      />
    </SxBox>
  );
};

export const TwoLevelsHierarchy = Template.bind({});
TwoLevelsHierarchy.args = {
  dataFetcher: dataFetcherTwoLevels,
  columns: columns,
  maxDepth: 2,
  dataFetcherConfig: { sortOrder: 'noDirection', sortField: 'name' },
  nodeIdentifierKey: 'name' as keyof object,
};

export const DeepHierarchy = Template.bind({});
DeepHierarchy.args = {
  dataFetcher: dataFetcherDeep,
  columns: columns as HierarchicalTreeColumnConfig<object>[],
  maxDepth: 5,
  dataFetcherConfig: { sortOrder: 'noDirection', sortField: 'name' },
  nodeIdentifierKey: 'name' as keyof object,
};

export const MixedHierarchy = Template.bind({});
MixedHierarchy.args = {
  dataFetcher: dataFetcherMixed,
  columns: columns as HierarchicalTreeColumnConfig<object>[],
  maxDepth: 4,
  dataFetcherConfig: { sortOrder: 'noDirection', sortField: 'name' },
  nodeIdentifierKey: 'name' as keyof object,
};

TwoLevelsHierarchy.storyName = 'Two levels of nesting';
DeepHierarchy.storyName = 'Deep nesting';
MixedHierarchy.storyName = 'Mixed nesting';
