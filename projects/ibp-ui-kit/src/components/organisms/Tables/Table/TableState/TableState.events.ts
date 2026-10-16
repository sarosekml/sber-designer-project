import { TableState } from './TableState.types';

/**
 * Description of the all events available for table
 * @TODO Add description for each event
 * @TODO Add more useful events for setting widths and hidden columns
 */
export interface TableStateControllerEvents<RowType extends object, Filter extends object> {
  setState: TableState<RowType, Filter>;
  resetState: void;

  // Cacheable state events
  setCurrentPage: TableState<RowType, Filter>['currentPage'];
  setFilters: TableState<RowType, Filter>['filters'];
  setPageSize: TableState<RowType, Filter>['pageSize'];
  setSorting: TableState<RowType, Filter>['sorting'];

  resetCurrentPage: void;
  resetFilters: void;
  resetPageSize: void;
  resetSorting: void;

  // UI state events
  setColumnOrder: TableState<RowType, Filter>['order'];
  setColumnWidths: TableState<RowType, Filter>['columnWidths'];
  setFixedColumns: TableState<RowType, Filter>['fixedColumns'];
  setHiddenColumns: TableState<RowType, Filter>['hiddenColumnNames'];
  setSelectedRowIndex: TableState<RowType, Filter>['selectedRowIndex'];
  setGroupingColumns: TableState<RowType, Filter>['grouping'];
  setSelectedRowsWithCheckbox: TableState<RowType, Filter>['selectedRowsWithCheckbox'];

  resetColumnOrder: void;
  resetColumnWidths: void;
  resetFixedColumns: void;
  resetHiddenColumns: void;
  resetSelectedRowIndex: void;
  resetGroupingColumns: void;
  resetSelectedRowsWithCheckbox: void;

  /**
   * Pass request id to get targeted response otherwise it will be broadcasted
   */
  requestState: string | undefined;
}

export interface TableStateEvents<RowType extends object, Filter extends object> {
  tableStateResponse: {
    requestId?: string;
    tableState: TableState<RowType, Filter>;
  };
  tableStateChanged: TableState<RowType, Filter>;
}
