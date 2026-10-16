import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { SearchRequestDto, SearchResponseDto } from '@sber-ibp/core';

import { CacheableTable } from '../CacheableTable';
import { defaultPageSize, defaultPageSizes, Row, RowsConfig } from '../Table';
import { TableState } from '../Table/TableState';

import { TemplatedTableProps } from './TemplatedTable.types';
import { useRowEventHandler } from './TemplatedTable.utils';
import { useTemplatedTableEventsSubscription } from './useTemplatedTableEventsSubscription';

const TemplatedTableComponent = <RowType extends object, Filter extends object, RowDataType extends object = RowType>({
  tableCode,
  dataTestId,
  rowProps,
  rowTemplate,
  fetchData,
  paging,
  rowDetailConfig,
  staticFilters,
  onTableStateChanged: onTableStateChangedCallback,
  ...props
}: TemplatedTableProps<RowType, Filter, RowDataType>) => {
  /**
   * The data which is updated in runtime and stored in table only till the next data fetching
   */
  const [updatedRowData, setUpdatedRowData] = useState<Record<number, RowDataType>>({});
  const [additionalRows, setAdditionalRows] = useState<RowDataType[]>([]);
  const [removedRowIds, setRemovedRowIds] = useState<Set<number>>(new Set());

  const [selectedRowIndex, setSelectedRowIndex] = useState<number>();
  const [configState, setConfigState] = useState<SearchRequestDto<Filter>>();
  const [searchResponse, setSearchResponse] = useState<SearchResponseDto<RowDataType>>();
  const [isLoading, setLoading] = useState(false);

  const { visibleItems, relativeToReal } = useMemo(() => {
    const relativeToReal = new Map<number, number>();

    if (!searchResponse) return { relativeToReal: relativeToReal };
    let offset = 0;

    const allItems = [...searchResponse.items, ...additionalRows].map((item, index) => updatedRowData[index] ?? item);
    const visibleItems = allItems.filter((_it, index) => {
      const isRemoved = removedRowIds.has(index);
      // Additional map fulfilling logic (Start)
      if (isRemoved) {
        offset++;
      } else {
        relativeToReal.set(index - offset, index);
      }
      // Additional map fulfilling logic (End)
      return !isRemoved;
    });
    return { visibleItems, relativeToReal: relativeToReal };
  }, [additionalRows, removedRowIds, searchResponse, updatedRowData]);

  const onUpdateData = useCallback(
    async (config: SearchRequestDto<Filter>) => {
      const finalConfig: SearchRequestDto<Filter> = {
        ...config,
        filters: {
          ...config.filters,
          ...(staticFilters as Filter),
        },
      };
      setConfigState(config);
      setLoading(true);
      try {
        const response = await fetchData(finalConfig);
        setUpdatedRowData({});
        setAdditionalRows([]);
        setRemovedRowIds(new Set());
        setSearchResponse(response);
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    },
    [fetchData, staticFilters],
  );

  const updateRowWithIndex = useCallback(
    (index: number, data: RowDataType) => {
      const realIndex = relativeToReal.get(index) ?? index;
      setUpdatedRowData({
        ...updatedRowData,
        [realIndex]: data,
      });
    },
    [updatedRowData, relativeToReal],
  );

  const addRow = useCallback(
    (data: RowDataType) => {
      setAdditionalRows([...additionalRows, data]);
    },
    [additionalRows, updatedRowData],
  );

  const removeRow = useCallback(
    (index: number) => {
      const realIndex = relativeToReal.get(index) ?? index;
      if (removedRowIds.has(realIndex)) {
        return;
      }
      setRemovedRowIds(new Set([...removedRowIds, realIndex]));
    },
    [relativeToReal, removedRowIds],
  );

  useTemplatedTableEventsSubscription({
    tableCode,
    isLoading,
    configState,
    hasItems: Boolean(visibleItems?.length),
    onUpdateData,
    updateRowWithIndex,
    addRow,
    removeRow,
  });

  const rows = useMemo(
    () =>
      (visibleItems?.map((item, index) => ({ ...rowTemplate(item, index), data: item })) ?? []) as
        | Row<RowType>[]
        | RowsConfig<RowType>,
    [visibleItems, rowTemplate],
  );

  const onRowClick = useRowEventHandler(visibleItems, rowProps?.onRowClick);
  const onDoubleRowClick = useRowEventHandler(visibleItems, rowProps?.onDoubleRowClick);
  const renderHover = useRowEventHandler(visibleItems, rowProps?.hoverConfig?.render);

  const onTableStateChanged = useCallback(
    (state: TableState<RowType, Filter>, prevState: TableState<RowType, Filter> | undefined) => {
      setSelectedRowIndex(state.selectedRowIndex);
      onTableStateChangedCallback?.(state, prevState);
    },
    [onTableStateChangedCallback],
  );

  useEffect(() => {
    const rowIsSelected = typeof selectedRowIndex === 'number' && visibleItems;
    rowProps?.onSelectedRowChanged?.(
      rowIsSelected
        ? {
            data: visibleItems[selectedRowIndex],
            index: selectedRowIndex,
          }
        : undefined,
    );
  }, [rowProps, visibleItems, selectedRowIndex]);

  return (
    <CacheableTable
      {...props}
      tableCode={tableCode}
      dataTestId={dataTestId}
      isLoading={isLoading || !searchResponse}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      updateData={onUpdateData}
      onTableStateChanged={onTableStateChanged}
      rows={rows}
      rowDetailConfig={rowDetailConfig}
      paging={
        paging
          ? {
              currentPage: searchResponse?.listInfo.offset ?? 0,
              pageSize: defaultPageSize,
              pageSizes: defaultPageSizes,
              totalCount: searchResponse?.listInfo.count ?? 100,
              ...(typeof paging === 'object' ? paging : undefined),
            }
          : undefined
      }
      rowProps={{
        ...rowProps,
        onDoubleRowClick,
        onRowClick,
        hoverConfig:
          rowProps?.hoverConfig && renderHover
            ? {
                ...rowProps.hoverConfig,
                render: renderHover,
              }
            : undefined,
      }}
    />
  );
};

export const TemplatedTable = memo(TemplatedTableComponent) as typeof TemplatedTableComponent & {
  displayName: string;
};
TemplatedTable.displayName = 'TemplatedTable';
