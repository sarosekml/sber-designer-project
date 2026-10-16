import { ReactNode } from 'react';
import { SortingDirection, TableHeaderRow } from '@devexpress/dx-react-grid';

import { ColumnName, ColumnWidthInfo } from './TableBase.types';

export interface ColumnsState<RowType extends object> {
  columnOrderState: ColumnName<RowType>[];
  columnWidthsState: ColumnWidthInfo<RowType>[];
  hiddenColumnsState: ColumnName<RowType>[];
}

export interface Column<RowType> {
  /**
   * Identifier of the column (usually equal to one of the RowType fields)
   */
  name: ColumnName<RowType>;
  /**
   * Title text of the column
   */
  title?: string;
}

/**
 * Generally the type is a combination of:
 * - TableColumnWidthInfo<RowType>,
 * - Sorting<RowType>,
 * - SortingExtension<RowType>,
 * - ResizingExtension<RowType>,
 * - ColumnWidthInfo<RowType>
 * types, but the property `columnName` changed to `name`,
 * and some required properties in the combined types
 * are optional in this combination.
 */
export interface ColumnDefinition<RowType> extends Column<RowType> {
  /**
   * Defines if column should be hidden from final render
   * @default false
   */
  hidden?: boolean;
  /**
   * Defines if sorting enabled or disabled for the column
   * @default false
   */
  sortingEnabled?: boolean;
  /**
   * Defines the default direction of the sorting (if sorting is enabled)
   * @default 'asc'
   */
  sortingDirection?: SortingDirection;
  /**
   * Tells how the text content of the cell in the column should be aligned
   * @default undefined
   */
  align?: 'left' | 'right' | 'center';
  /**
   * Introduces custom render function for header cell of the column
   * @default undefined
   */
  render?: (props: TableHeaderRow.CellProps) => ReactNode;
  /**
   * Specifies whether word wrap is enabled in a column's cells,
   * if not then the text in each cell of the column is aligned in one line.
   * @default false
   */
  wordWrapEnabled?: boolean;
  /**
   * Defines the default width of the column,
   * the default can be also defined by `columnsResizing` parameter
   * @default 200 or defined by `columnsResizing` parameter
   */
  width?: number;
  /**
   * Min column width
   * @default 80 or defined by `columnsResizing` parameter
   */
  minWidth?: number;
  /**
   * Max column width
   * @default 600 or defined by `columnsResizing` parameter
   */
  maxWidth?: number;
  /**
   * Defines which side the column will be fixed on
   * @default undefined
   */
  fixed?: 'left' | 'right';
  /**
   * Defines if the column can change the order or not
   */
  fixedOrder?: boolean;
}

export type ColumnsConfig<RowType> = ColumnDefinition<RowType>[];
