import React, { memo, useEffect, useMemo, useState } from 'react';
import { Plugin } from '@devexpress/dx-react-core';
import { CustomGrouping, Grouping, GroupingState, SortingState } from '@devexpress/dx-react-grid';

import { ColumnName, RowsConfig } from '../../TableProps';

interface Props<RowData extends object> {
  grouping?: ColumnName<RowData>[];
  rows: RowsConfig<RowData>;
}

const GroupingPluginComponent = <RowData extends object>({ grouping, rows }: Props<RowData>) => {
  const [expandedGroups, setExpandedGroups] = useState<string[] | undefined>(undefined);

  const groupingState = useMemo(() => grouping?.map((columnName) => ({ columnName })) ?? [], [grouping]);

  const getChildGroups = (rows: RowsConfig<RowData>, grouping: Grouping) => {
    const columnName = grouping.columnName;
    /**
     * All unique values of field 'columnName' are group keys
     */
    const groupKeys = Array.from(new Set(rows?.map((item) => item.data?.[columnName])));
    return (
      groupKeys?.map((groupKey) => {
        const childRows = rows.filter((row) => row?.data?.[columnName] === groupKey);
        const value = rows.find((row) => row?.data?.[columnName] === groupKey)?.cells[columnName];
        return {
          key: groupKey,
          value: value,
          childRows,
        };
      }) ?? []
    );
  };

  const onExpandedGroupsChange = (newExpandedGroups: string[]) => {
    setExpandedGroups(newExpandedGroups);
  };

  /**
   * Getting the keys of the first group
   * The first level of grouping will be expanded by default
   */
  useEffect(() => {
    const columnName = grouping?.[0];
    if (columnName) {
      const groupKeys = Array.from(new Set(rows?.map((item) => item.data?.[columnName]))) as string[];
      setExpandedGroups(groupKeys);
    }
  }, [grouping, rows]);

  return (
    <Plugin>
      {/**
       * In the old version of the table, there must be a sorting plugin before grouping
       */}
      <SortingState />
      <GroupingState
        grouping={groupingState}
        expandedGroups={expandedGroups}
        onExpandedGroupsChange={onExpandedGroupsChange}
      />
      <CustomGrouping getChildGroups={getChildGroups} />
    </Plugin>
  );
};

export const GroupingPlugin = memo(GroupingPluginComponent) as typeof GroupingPluginComponent & {
  displayName: string;
};
GroupingPlugin.displayName = 'GroupingPlugin';
