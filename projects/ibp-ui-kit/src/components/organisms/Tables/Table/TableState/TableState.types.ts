import { ColumnName, ColumnWidthInfo, FixedColumnsInfo, Sorting } from '../TableProps';

/**
 * Table component has tree parts of the state:
 * - the one which defines the data fetching state
 * - the one which defines the ui state
 * - the one which defines the immutable state, which can be initialized by initialState or defaultState and cannot be changed
 * This hook provides the parts of the Table state which
 * defines the data fetching state
 */
export interface DataFetchingState<RowType extends object, Filter extends object> {
  currentPage: number;
  pageSize?: number;
  filters?: Filter;
  sorting: Sorting<RowType>[];
}

/**
 * The object to control cacheable state
 */
export interface DataFetchingStateController<RowType extends object, Filter extends object> {
  setState: (newState: DataFetchingState<RowType, Filter>) => void;
  resetState: () => void;

  setCurrentPage: (currentPage: DataFetchingState<RowType, Filter>['currentPage']) => void;
  setFilters: (filters: DataFetchingState<RowType, Filter>['filters']) => void;
  setPageSize: (pageSize: DataFetchingState<RowType, Filter>['pageSize']) => void;
  setSorting: (sorting: DataFetchingState<RowType, Filter>['sorting']) => void;

  resetCurrentPage: () => void;
  resetFilters: () => void;
  resetPageSize: () => void;
  resetSorting: () => void;
}

/**
 * Table component has three parts of the state:
 * - the one which defines the data fetching state
 * - the one which defines the ui state
 * - the one which defines the immutable state, which can be initialized by initialState or defaultState and cannot be changed
 * This hook provides the parts of the Table state which
 * defines the ui state
 */
export interface UiState<RowType extends object> {
  columnWidths: ColumnWidthInfo<RowType>[];
  hiddenColumnNames: ColumnName<RowType>[];
  order: Extract<keyof RowType, string>[];
  selectedRowIndex: number | undefined;
  fixedColumns: FixedColumnsInfo<RowType>;
  grouping?: ColumnName<RowType>[];
  selectedRowsWithCheckbox?: (string | number)[];
}

export interface UiStateController<RowType extends object> {
  setState: (newState: UiState<RowType>) => void;
  resetState: () => void;

  /**
   * Make sure you provide all column names as a value,
   * otherwise it can lead to null-pointer exceptions
   */
  setColumnOrder: (nextOrder: ColumnName<RowType>[]) => void;
  /**
   * Make sure you provide width values for all columns,
   * otherwise it can lead to null-pointer exceptions
   */
  setColumnWidths: (nextColumnWidths: ColumnWidthInfo<RowType>[]) => void;
  setHiddenColumns: (hiddenColumnNames: ColumnName<RowType>[]) => void;
  setSelectedRowIndex: (selectedRowIndex: number | undefined) => void;
  setFixedColumns: (fixedColumns: FixedColumnsInfo<RowType>) => void;
  setGroupingColumns: (newGroupingColumns?: ColumnName<RowType>[]) => void;
  setSelectedRowsWithCheckbox: (selectedRowsWithCheckbox?: (string | number)[]) => void;

  resetColumnOrder: () => void;
  resetColumnWidths: () => void;
  resetHiddenColumns: () => void;
  resetSelectedRowIndex: () => void;
  resetFixedColumns: () => void;
  resetGroupingColumns: () => void;
  resetSelectedRowsWithCheckbox: () => void;
}

export interface ScrollState {
  top?: number;
  left?: number;
}

/**
 * Table component has three parts of the state:
 * - the one which defines the data fetching state
 * - the one which defines the ui state
 * - the one which defines the immutable state, which can be initialized by initialState or defaultState and cannot be changed
 *
 * This hook provides the parts of the Table state which
 * defines the immutable state
 */
export interface ImmutableState<RowType extends object> {
  scroll?: ScrollState;
}

export interface ImmutableStateController<RowType extends object> {
  setScroll: (scroll?: ScrollState) => void;
  resetScroll: () => void;
}

export type TableState<RowType extends object, Filter extends object> = DataFetchingState<RowType, Filter> &
  UiState<RowType> &
  ImmutableState<RowType>;

export interface TableStateController<RowType extends object, Filter extends object>
  extends Omit<DataFetchingStateController<RowType, Filter>, 'setState'>,
    Omit<UiStateController<RowType>, 'setState'> {
  setState: (newState: TableState<RowType, Filter>) => void;
}
