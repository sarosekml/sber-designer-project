import React, { memo, useCallback, useLayoutEffect, useState } from 'react';

import { triggerEvent } from '@sber-ibp/core';

import { Grid, Splitter } from '@/components/atoms';

import { makeRowHoverEventChannel, RowEvents } from '../Table';
import { TableState } from '../Table/TableState';
import { RowDefinition, TemplatedTable } from '../TemplatedTable';
import { useTemplatedTable } from '../utils';

import { BrowsableTableProps } from './BrowsableTable.types';

const BrowsableTableComponent = <RowType extends object, Filter extends object, RowDataType extends object = RowType>({
  tableCode,
  Preview: PreviewComponent,
  dataTestId,
  height,
  onTableStateChanged: onTableStateChangedCallback,
  rowProps,
  shouldHidePreviewOnStateChanged,
  ...props
}: BrowsableTableProps<RowType, Filter, RowDataType>) => {
  const { tableState, controller } = useTemplatedTable<RowType, Filter, RowDataType>(tableCode);
  const [selectedRow, setSelectedRow] = useState<RowDataType>();
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>();

  const onRowClick = useCallback(
    (row?: RowDefinition<RowDataType>) => {
      if (row?.index === tableState?.selectedRowIndex) {
        controller.resetSelectedRowIndex();
      }
    },
    [tableState, controller],
  );

  const onRowChanged = useCallback((row?: RowDefinition<RowDataType>) => {
    setSelectedRow(row?.data);
    setSelectedRowIndex(row?.index);
  }, []);

  const hasStateChanged = useCallback(
    (newState: TableState<RowType, Filter>, prevState: TableState<RowType, Filter> | undefined) => {
      return ['currentPage', 'sorting', 'filters', 'hiddenColumnNames'].some(
        (prop) => newState?.[prop] !== prevState?.[prop],
      );
    },
    [],
  );

  const onTableStateChanged = useCallback(
    (newState: TableState<RowType, Filter>, prevState: TableState<RowType, Filter> | undefined) => {
      onTableStateChangedCallback?.(newState, prevState);
      if (shouldHidePreviewOnStateChanged && hasStateChanged(newState, prevState)) {
        controller.resetSelectedRowIndex();
      }
    },
    [controller, hasStateChanged, shouldHidePreviewOnStateChanged, onTableStateChangedCallback],
  );

  // Changing of the size of the table can change the height of the rows,
  // so we have to recalculate hover
  useLayoutEffect(
    () => triggerEvent<RowEvents, 'resize'>(makeRowHoverEventChannel(tableCode), 'resize', undefined),
    [selectedRow, tableCode],
  );

  return (
    <Splitter
      dataTestId={dataTestId}
      leftColumn={
        <Grid height={height} item display={'flex'}>
          <TemplatedTable
            tableCode={tableCode}
            dataTestId={dataTestId}
            onTableStateChanged={onTableStateChanged}
            rowProps={{
              ...rowProps,
              onRowClick,
              onSelectedRowChanged: onRowChanged,
            }}
            {...props}
          />
        </Grid>
      }
      rightColumn={
        selectedRow && tableState ? (
          <Grid height={height} item>
            <PreviewComponent
              tableState={tableState}
              controller={controller}
              selectedRow={selectedRow}
              index={selectedRowIndex ?? 0}
            />
          </Grid>
        ) : null
      }
    />
  );
};

export const BrowsableTable = memo(BrowsableTableComponent) as typeof BrowsableTableComponent;
