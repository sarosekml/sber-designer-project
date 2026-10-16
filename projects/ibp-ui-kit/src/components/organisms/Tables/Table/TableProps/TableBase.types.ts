import { ReactNode } from 'react';
import {
  Sorting as DESorting,
  SortingState as DESortingState,
  TableColumnResizing as DEResizing,
  TableColumnWidthInfo as DETableColumnWidthInfo,
} from '@devexpress/dx-react-grid';
import { Table as DETable } from '@devexpress/dx-react-grid-material-ui';

import { FixedSide } from '@sber-ibp/core';

/**
 * Basic table types and extensions
 */
export type BaseData = string | number | boolean;
export type ColumnName<RowType> = Extract<keyof RowType, string>;
export type CellData<RowType> = RowType | BaseData | Array<string | number | object>;

export interface SortingExtension<RowType> extends DESortingState.ColumnExtension {
  columnName: ColumnName<RowType>;
}

export interface ResizingExtension<RowType extends object> extends DEResizing.ColumnExtension {
  columnName: ColumnName<RowType>;
}

export interface ColumnWidthInfo<RowType extends object> extends DETableColumnWidthInfo {
  columnName: ColumnName<RowType>;
}

export type FixedColumnsInfo<RowType extends object> = Map<ColumnName<RowType>, FixedSide | undefined>;

export interface Sorting<RowType extends object> extends Omit<DESorting, 'columnName'> {
  columnName: ColumnName<RowType>;
}

export interface ColumnExtension<RowType extends object> extends Omit<DETable.ColumnExtension, 'columnName'> {
  columnName: ColumnName<RowType>;
  render?: (row?: CellData<RowType>) => ReactNode;
}

/**
 * Table Paging props
 */

export interface PagingProp {
  /**
   * Initial number of current page (starts from 0). 'onCurrentPageChange' prop is required.
   */
  currentPage?: number;
  /**
   * Initial number of rows per page
   */
  pageSize?: number;
  /**
   * Total rows count (all pages)
   */
  totalCount?: number;
  /**
   * Array of available page sizes. 0 - show all rows
   */
  pageSizes?: number[];
}

export interface ResizingProp<RowType extends object> {
  /**
   * Specifies the resizing mode: 'widget' (default) or 'nextColumn'.
   * In widget mode, auto and percentage values cannot be used to specify column widths.
   */
  resizingMode?: 'nextColumn' | 'widget';
  /**
   * Initial array of widths (for non-virtual tables only).
   * @deprecated please use `columns[number].width` parameter
   */
  columnWidths?: ColumnWidthInfo<RowType>[];
  /**
   * @deprecated please use `columns[number].maxWidth` and
   * `columns[number].minWidth` parameters
   */
  columnExtensions?: ResizingExtension<RowType>[];
  /**
   * Default column width
   * @default 200
   */
  width?: number;
  /**
   * Default min column width
   * @default 80
   */
  minWidth?: number;
  /**
   * Default max column width
   * @default 600
   */
  maxWidth?: number;
}

/**
 * Table representation config
 **/
export type TableVirtualConfigProp =
  | {
      isVirtualTable?: false;
    }
  | {
      /** If you use table virtualization, you must specify estimatedRowHeight for the table to work correctly. */
      isVirtualTable: true;
      /** Estimated row height. Specify the average value for a table whose rows have different heights. */
      estimatedRowHeight?: number;
    };

export type TableConfigProp = {
  /**
   * If you want to make the table header sticky.
   * (!) Requires the 'height' prop.
   * (Can be used only with the default table. The Virtualized table has a sticky header by default)
   */
  hasStickyHeader?: boolean;
  /**
   * Table height. Required for table with the 'hasStickyHeader' or 'isVirtualTable' prop.
   * @default 530
   */
  height?: string | number;
} & TableVirtualConfigProp;

export interface TableStylesProps extends Pick<TableConfigProp, 'height'> {
  isBordered?: boolean;
}

/**
 * Table localization props
 */

export interface TableMessages {
  showAll: string;
  rowsPerPage: string;
  noData: string;
  loading: string;
  noColumns: string;
}

export interface TablePaging {
  sort: string;
  limit: number;
  offset: number;
  returnCount: boolean;
  returnOnlyCount?: boolean;
}
