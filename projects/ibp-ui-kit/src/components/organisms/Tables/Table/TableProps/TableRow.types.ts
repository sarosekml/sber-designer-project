import { ReactNode } from 'react';

import { BaseData, CellData, ColumnName } from './TableBase.types';

/**
 * @deprecated use `RowCellFormat` instead
 */
export interface TableRowFormat<RowType> {
  data?: CellData<RowType>;
  rowSpan?: number;
  exportRender?: (row?: CellData<RowType>) => BaseData;
  render?: (row?: CellData<RowType>) => ReactNode | BaseData;
  editRender?: (row?: CellData<RowType>) => ReactNode | BaseData;
  isAfterRowspan?: boolean;
  skipRender?: boolean;
}

/**
 * @deprecated use `RowCells`
 */
export type Row<RowType> = Record<ColumnName<RowType>, TableRowFormat<RowType> | BaseData>;

export type HoverStickOrientation = 'left' | 'right';

export interface HoverConfig<RowType extends object> {
  /**
   * The function to render row hover with provided parameters
   */
  render: (row: Row<RowType>, rowIndex: number, rowSchema: TableColorSchema) => ReactNode;
  /**
   * @default 'right'
   */
  stickTo?: HoverStickOrientation;
}

export interface RowProps<RowType extends object> {
  /**
   * Specifies the name of the column which should be used for identifying rows
   */
  identifColumn?: string;
  /**
   * Index of default selected row in 'rows'
   */
  defaultSelectedRowIndex?: number;
  /**
   * Row click handler
   */
  onRowClick?: (row: Row<RowType>, selectedRowIndex: number) => void;
  /**
   * Row double click handler
   */
  onDoubleRowClick?: (row: Row<RowType>, selectedRowIndex: number) => void;
  /**
   * Defines the set of colors for the following states: focus/default/selected
   */
  rowColorSchema?: TableColorSchema;
  /**
   * The callback which defines the row hover feature - any component or primitive can be rendered as a result of callback.
   */
  hoverConfig?: HoverConfig<RowType>;
}

export type RowCellData<RowType extends object> = RowType[keyof RowType];

export interface TableColorSchema {
  default?: string;
  hover?: string;
  focus?: string;
}

export interface RowCellFormat<RowType extends object> {
  /**
   * @deprecated please pass it to closer to render function if possible.
   */
  data?: RowCellData<RowType>;
  rowSpan?: number;
  /**
   * @deprecated please use `render` function
   */
  exportRender?: (row?: RowCellData<RowType>) => ReactNode;
  render?: (row?: RowCellData<RowType>) => ReactNode;
  /**
   * @deprecated please use `render` function
   */
  editRender?: (row?: RowCellData<RowType>) => ReactNode;
  isAfterRowspan?: boolean;
  skipRender?: boolean;
  colorSchema?: TableColorSchema;
  hasEditMark?: boolean;
  selected?: boolean;
  editMarkTooltipTitle?: string;
}

export type RowCells<RowType extends object> = Record<ColumnName<RowType>, RowCellFormat<RowType> | React.ReactNode>;

export interface RowView<RowType extends object> {
  colorSchema?: TableColorSchema;
  data?: RowType;
  cells: RowCells<RowType>;
}

export type RowsConfig<RowType extends object> = RowView<RowType>[];

export const isRowView = <RowType extends object>(row: Row<RowType> | RowView<RowType>): row is RowView<RowType> =>
  'cells' in row;
export const isRowsConfig = <RowType extends object>(
  rows: Row<RowType>[] | RowsConfig<RowType>,
): rows is RowsConfig<RowType> => rows && rows[0] && 'cells' in rows[0];
