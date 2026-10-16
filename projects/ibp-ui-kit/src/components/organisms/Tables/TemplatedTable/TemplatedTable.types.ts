import { SearchRequestDto, SearchResponseDto } from '@sber-ibp/core';

import { CacheableTableProps } from '../CacheableTable';
import { HoverConfig, PagingProp, Row, RowProps, RowView, TableColorSchema } from '../Table/TableProps';
import { TableState, TableStateController } from '../Table/TableState';

export type TableDataFetchCallback<RowDataType extends object, Filter extends object> = (
  config: SearchRequestDto<Filter>,
) => Promise<SearchResponseDto<RowDataType>>;

export interface RowDefinition<RowType extends object> {
  data: RowType;
  index: number;
}

export interface TemplatedHoverConfig<RowDataType extends object> extends Omit<HoverConfig<RowDataType>, 'render'> {
  /**
   * The function to render row hover with provided parameters
   */
  render: (row: RowDefinition<RowDataType>, rowSchema: TableColorSchema) => React.ReactNode;
}

export type TemplatedRowProps<RowDataType extends object> = Omit<
  RowProps<RowDataType>,
  'onRowClick' | 'onDoubleRowClick' | 'hoverConfig'
> & {
  onDoubleRowClick?: (row?: RowDefinition<RowDataType>) => void;
  onRowClick?: (row?: RowDefinition<RowDataType>) => void;
  onSelectedRowChanged?: (row?: RowDefinition<RowDataType>) => void;
  hoverConfig?: TemplatedHoverConfig<RowDataType>;
};

export type TableRowTemplate<RowType extends object, RowDataType extends object = RowType> =
  | ((rowData: RowDataType, index: number) => Row<RowType>)
  | ((rowData: RowDataType, index: number) => RowView<RowType>);

export type TemplatedTableProps<
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
> = Omit<CacheableTableProps<RowType, Filter>, 'rowProps' | 'rows' | 'updateData' | 'paging' | 'isLoading'> & {
  fetchData: TableDataFetchCallback<RowDataType, Filter>;
  /**
   * If 'true' | Object the pagination is active otherwise disabled.
   */
  paging?: Omit<PagingProp, 'totalCount' | 'currentPage'> | boolean;
  rowProps?: TemplatedRowProps<RowDataType>;
  rowTemplate: TableRowTemplate<RowType, RowDataType>;
  staticFilters?: Partial<Filter>;
};

export interface TemplatedTableStateController<
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
> extends TableStateController<RowType, Filter> {
  refetchData: () => void;
  updateTableRow: (index: number, data: RowDataType) => void;
  addTableRow: (data: RowDataType) => void;
  removeTableRow: (index: number) => void;
}

export interface TemplatedTableStatePart {
  hasItems: boolean;
  isLoading: boolean;
}

export type TemplatedTableState<RowType extends object, Filter extends object> = TableState<RowType, Filter> &
  TemplatedTableStatePart;
