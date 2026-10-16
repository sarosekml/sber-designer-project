import React, { memo } from 'react';
import { RowDetailState } from '@devexpress/dx-react-grid';
import {
  Grid as DEGrid,
  Table as DETable,
  TableGroupRow,
  TableHeaderRow,
  TableRowDetail,
  VirtualTable,
} from '@devexpress/dx-react-grid-material-ui';
import { Grid } from '@mui/material';
import Paper from '@mui/material/Paper';

import { Loader } from '@/components/atoms/loaders';
import { getDataTestId } from '@/utils';

import { DetailCell } from './components/TableCell/DetailCell';
import { GroupingPlugin } from './plugins/GroupingPlugin';
import {
  DetailRow,
  GroupComponent,
  HeaderCell,
  NoDataCell,
  Root,
  SortingLabel,
  StickyTable,
  TableCell,
  TableContainer,
  TableFixedColumns,
  TableRow,
  ToggleCellComponent,
} from './components';
import { useTable } from './hooks';
import { getTablePagingPlugins, getTablePlugins, getTableSelectionPlugins } from './plugins';
import { getTableStyles, loaderSx } from './Table.styles';
import { TableProps } from './Table.types';
import { TableContextProvider } from './TableContextProvider';
import { useTableProps } from './TableProps';

const TableComponent = <RowType extends object, Filter extends object>(rawProps: TableProps<RowType, Filter>) => {
  const props = useTableProps<RowType, Filter>(rawProps);
  const { tableState, controller } = useTable(props);

  const {
    canChangeSorting,
    classes,
    columns,
    dataTestId,
    isLoading,
    rows,
    tableColumnExtensions,
    tableConfig,
    isBordered,
    canFixColumns,
    rowDetailConfig,
    grouping,
    onResetTableSettings, 
  } = props;
  const { height, hasStickyHeader } = tableConfig;

  return (
    <TableContextProvider
      tableProps={props}
      tableState={tableState}
      tableStateController={controller}
      onResetTableSettings={onResetTableSettings} 
    >
      <Paper
        sx={getTableStyles({ isBordered, height })}
        className={classes?.root}
        style={{ maxHeight: height }}
        data-testid={getDataTestId(dataTestId, 'Table')}
      >
        <DEGrid rows={rows} columns={columns} rootComponent={Root}>
          <GroupingPlugin grouping={grouping} rows={rows} />
          {tableConfig.isVirtualTable ? (
            <VirtualTable
              height={height ? 'auto' : '530px'}
              estimatedRowHeight={tableConfig.estimatedRowHeight}
              columnExtensions={tableColumnExtensions}
              rowComponent={TableRow}
              cellComponent={TableCell}
              noDataCellComponent={NoDataCell}
              containerComponent={TableContainer}
            />
          ) : (
            <DETable
              tableComponent={hasStickyHeader ? StickyTable : DETable.Table}
              rowComponent={TableRow}
              cellComponent={TableCell}
              columnExtensions={tableColumnExtensions}
              noDataCellComponent={NoDataCell}
              containerComponent={TableContainer}
            />
          )}

          <RowDetailState />

          {getTableSelectionPlugins({
            tableProps: props,
            tableState,
            tableStateController: controller,
          })}
          {getTablePlugins({
            tableProps: props,
            tableState,
            tableStateController: controller,
          })}
          <TableHeaderRow
            showSortingControls={canChangeSorting}
            cellComponent={HeaderCell}
            sortLabelComponent={SortingLabel}
          />

          {rowDetailConfig?.contentComponent && (
            <TableRowDetail
              toggleCellComponent={ToggleCellComponent}
              contentComponent={rowDetailConfig?.contentComponent}
              cellComponent={DetailCell}
              rowComponent={DetailRow}
            />
          )}

          <TableGroupRow contentComponent={GroupComponent} />
          {canFixColumns || tableState.fixedColumns.size ? (
            <TableFixedColumns fixedColumns={tableState.fixedColumns} />
          ) : null}
          {/*
           * Footer plugins are rendered last to avoid side effects.
           * Otherwise, the fixed columns of the table may not work correctly.
           */}
          {getTablePagingPlugins({
            tableProps: props,
            tableState,
            tableStateController: controller,
          })}
        </DEGrid>

        {isLoading && (
          <Grid sx={loaderSx}>
            <Loader dataTestId={dataTestId} />
          </Grid>
        )}
      </Paper>
    </TableContextProvider>
  );
};

export const Table = memo(TableComponent) as typeof TableComponent;
