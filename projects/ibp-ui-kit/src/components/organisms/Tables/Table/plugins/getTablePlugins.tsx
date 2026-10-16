import React, { useMemo } from 'react';
import { Plugin } from '@devexpress/dx-react-core';
import {
  CustomPaging,
  IntegratedSelection,
  PagingState,
  SelectionState,
  SortingState,
} from '@devexpress/dx-react-grid';
import {
  DragDropProvider,
  PagingPanel,
  TableColumnResizing,
  TableSelection,
} from '@devexpress/dx-react-grid-material-ui';
import { Checkbox as MUICheckbox, TableCell as MUITableCell, TableFooter as MUITableFooter } from '@mui/material';

import { CustomHeaderCellWithCheckbox } from '../components';
import { TableInternalPlainModel } from '../TableProps';
import { TableState, TableStateController } from '../TableState';

import { ColumnReorderingPlugin } from './ColumnReorderingPlugin';
import { ColumnVisibilityManagerPlugin } from './ColumnVisibilityManagerPlugin';

export interface TablePluginsProps<RowType extends object, Filter extends object> {
  tableProps: TableInternalPlainModel<RowType, Filter>;
  tableState: TableState<RowType, Filter>;
  tableStateController: TableStateController<RowType, Filter>;
}

const getCurrentRowsString = ({ from, to, count }: { [field: string]: number }) => {
  if (from === to || (from === 1 && count === to)) return `${to}`;
  return `${from}-${to}`;
};

const infoMessage = ({ count, from, to }: { [field: string]: number }) =>
  `${getCurrentRowsString({
    count,
    from,
    to,
  })} из ${count}`;

/**
 * The utility function which group all used plugins in one place
 * and returns them as a list of plugins
 */
export const getTablePlugins = <RowType extends object, Filter extends object>({
  tableProps: {
    canChangeSorting,
    canChangeVisibility,
    canReorderColumns,
    canResizeColumns,
    maxColumnWidth,
    minColumnWidth,
    resizingColumnExtensions,
    resizingMode,
    sortingColumnExtensions,
    staticOrder,
  },
  tableState: { sorting, columnWidths, order },
  tableStateController: { setColumnOrder, setColumnWidths, setSorting },
}: TablePluginsProps<RowType, Filter>) => {
  return [
    /**
     * Provides column sorting functionality (if `canChangeSorting` set to 'true')
     */
    canChangeSorting ? (
      <SortingState
        key="Sorting plugin"
        columnExtensions={sortingColumnExtensions}
        sorting={sorting}
        //eslint-disable-next-line
        //@ts-ignore columnName types are incompatible
        onSortingChange={setSorting}
      />
    ) : null,
    /**
     * Provides column resizing functionality (if `canResizeColumns` set to 'true')
     */
    canResizeColumns ? (
      <TableColumnResizing
        key="Resizing plugin"
        resizingMode={resizingMode}
        columnWidths={columnWidths}
        //eslint-disable-next-line
        //@ts-ignore columnName types are incompatible
        onColumnWidthsChange={setColumnWidths}
        minColumnWidth={minColumnWidth}
        maxColumnWidth={maxColumnWidth}
        columnExtensions={resizingColumnExtensions}
      />
    ) : null,
    /**
     * Provides the columns drag-n-drop functionality to allow reordering columns
     * (if `canReorderColumns` set to 'true')
     */
    canReorderColumns ? <DragDropProvider key="Reordering plugin 1" /> : null,
    /**
     * Provides the columns reordering functionality together with `drag-n-drop` plugin
     * (if `canReorderColumns` set to 'true')
     */
    canReorderColumns ? (
      <ColumnReorderingPlugin order={order} setOrder={setColumnOrder} staticOrderColumns={staticOrder} />
    ) : null,
    /**
     * Provides column hiding/showing functionality (if `canChangeVisibility` set to 'true')
     */
    canChangeVisibility ? <ColumnVisibilityManagerPlugin key="Columns visibility plugin" /> : null,
  ].filter((plugin) => Boolean(plugin));
};

export const getTablePagingPlugins = <RowType extends object, Filter extends object>({
  tableProps: { pageSizes, totalCount, canUsePagination, messages, customFooter },
  tableState: { currentPage, pageSize },
  tableStateController: { setCurrentPage: onCurrentPageChange, setPageSize: onPageSizeChange },
}: TablePluginsProps<RowType, Filter>) => {
  const pagingPanelMessages = useMemo(
    () => ({
      showAll: messages.showAll,
      rowsPerPage: messages.rowsPerPage,
      info: infoMessage,
    }),
    [messages],
  );
  return [
    canUsePagination ? (
      <Plugin key="Pagination plugin 1">
        <PagingState
          pageSize={pageSize}
          currentPage={currentPage}
          onCurrentPageChange={onCurrentPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </Plugin>
    ) : null,
    /**
     * Provides totalCount and pagination panel for pagination functionality, works together with `PagingState` plugin
     * (if `canUsePagination` set to 'true')
     */
    canUsePagination && !!totalCount ? (
      <Plugin key="Pagination plugin 2">
        <CustomPaging totalCount={totalCount} />
        <PagingPanel
          pageSizes={pageSizes}
          messages={pagingPanelMessages}
          containerComponent={(props) =>
            customFooter ? (
              <MUITableFooter>{customFooter(<PagingPanel.Container {...props} />)}</MUITableFooter>
            ) : (
              <PagingPanel.Container {...props} />
            )
          }
        />
      </Plugin>
    ) : null,
  ].filter((plugin) => Boolean(plugin));
};

export const getTableSelectionPlugins = <RowType extends object, Filter extends object>({
  tableProps: { canSelectRowsWithCheckbox },
  tableState: { selectedRowsWithCheckbox },
  tableStateController: { setSelectedRowsWithCheckbox },
}: TablePluginsProps<RowType, Filter>) => {
  return [
    canSelectRowsWithCheckbox ? (
      <SelectionState selection={selectedRowsWithCheckbox} onSelectionChange={setSelectedRowsWithCheckbox} />
    ) : null,
    canSelectRowsWithCheckbox ? <IntegratedSelection /> : null,
    canSelectRowsWithCheckbox ? (
      <TableSelection
        showSelectAll
        selectionColumnWidth={80}
        headerCellComponent={CustomHeaderCellWithCheckbox}
        cellComponent={(props) => (
          <MUITableCell {...props}>
            <MUICheckbox size="small" checked={props.selected} onChange={props.onToggle} />
          </MUITableCell>
        )}
      />
    ) : null,
  ].filter((plugin) => Boolean(plugin));
};
