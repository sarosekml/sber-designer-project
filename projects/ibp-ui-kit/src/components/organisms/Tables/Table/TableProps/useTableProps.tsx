import { useMemo } from 'react';
import { SortingDirection } from '@devexpress/dx-react-grid';

import { completeWithDefaults, emptyArray } from '@sber-ibp/core';

import { TableProps } from '../Table.types';
import { TableState } from '../TableState';

import {
  ColumnExtension,
  ColumnName,
  ColumnWidthInfo,
  FixedColumnsInfo,
  ResizingExtension,
  Sorting,
  SortingExtension,
  TableMessages,
} from './TableBase.types';
import { TableInternalPlainModel } from './TableProps.types';
import { isRowsConfig, RowsConfig } from './TableRow.types';

export const defaultMaxColumnWidth = 600;
export const defaultMinColumnWidth = 80;
export const defaultColumnWidth = 200;
export const defaultSortingDirection: SortingDirection = 'asc';
export const defaultSortingEnabled = false;
export const defaultChangeVisibility = false;

export const defaultPageSize = 50;
export const defaultPageSizes = [5, 10, 25, 50, 100];

export const defaultTableMessage: TableMessages = {
  showAll: 'Все',
  rowsPerPage: 'Показывать строк:',
  noData: 'Нет данных',
  loading: ' ',
  noColumns: 'Все колонки скрыты',
};

export type DefaultStateProps<RowType extends object, Filter extends object> = Pick<
  TableProps<RowType, Filter>,
  'columns' | 'defaultFilters' | 'paging' | 'rowProps' | 'grouping' | 'scroll'
>;

export const getDefaultState = <RowType extends object, Filter extends object>(
  props: DefaultStateProps<RowType, Filter>,
): TableState<RowType, Filter> => {
  const { columns = [], defaultFilters, paging: pagingProps, rowProps = {}, grouping = [], scroll } = props;

  const sortableColumns = columns.filter(({ sortingEnabled }) => Boolean(sortingEnabled));
  const defaultSorting: Sorting<RowType>[] = sortableColumns
    .filter(({ sortingDirection }) => Boolean(sortingDirection))
    .map(({ name, sortingDirection }) => ({
      columnName: name,
      direction: sortingDirection ?? defaultSortingDirection,
    }));

  const defaultColumnWidths: ColumnWidthInfo<RowType>[] = columns.map(({ name, width = defaultColumnWidth }) => ({
    columnName: name,
    width,
  }));

  const defaultColumnOrder: ColumnName<RowType>[] = columns.map(({ name }) => name);
  const defaultHiddenColumns: ColumnName<RowType>[] = columns.filter(({ hidden }) => hidden).map(({ name }) => name);
  const pageSize = pagingProps?.pageSize ?? defaultPageSize;
  const maxAvailablePage =
    pagingProps?.totalCount || pagingProps?.totalCount === 0
      ? Math.max(Math.ceil(pagingProps.totalCount / pageSize) - 1, 0)
      : Infinity;
  const currentPage = Math.min(pagingProps?.currentPage ?? 0, maxAvailablePage);

  const fixedColumns: FixedColumnsInfo<RowType> = new Map(columns?.map((it) => [it.name, it.fixed]));

  return {
    filters: defaultFilters,
    order: defaultColumnOrder,
    columnWidths: defaultColumnWidths,
    hiddenColumnNames: defaultHiddenColumns,
    currentPage,
    pageSize,
    sorting: defaultSorting,
    selectedRowIndex: rowProps.defaultSelectedRowIndex,
    fixedColumns,
    grouping,
    scroll,
    selectedRowsWithCheckbox: emptyArray,
  };
};

/**
 * The hook align props and set all necessary defaults.
 * Table component currently have two ways of defining props and this hook take both kinds of props and
 * convert to internal table model in the future we will work only with `RelevantTableProps`.
 */
export const useTableProps = <RowType extends object, Filter extends object>(
  props: TableProps<RowType, Filter>,
): TableInternalPlainModel<RowType, Filter> =>
  useMemo(() => {
    const {
      canChangeVisibility = defaultChangeVisibility,
      canReorderColumns = false,
      canFixColumns = false,
      canSelectRowsWithCheckbox = false,
      classes,
      columns = [],
      columnsResizing,
      dataTestId,
      initialState,
      isEditMode = false,
      isLoading = false,
      messages,
      onUiStateChanged,
      onTableStateChanged,
      paging: pagingProps,
      rowProps = {},
      rows,
      tableCode,
      tableConfig = { hasStickyHeader: true },
      updateColumnsConfig,
      rowDetailConfig,
      updateData,
      isBordered = false,
      customFooter,
      grouping,
      onResetTableSettings,
    } = props;

    const {
      maxWidth: maxColumnWidth = defaultMaxColumnWidth,
      minWidth: minColumnWidth = defaultMinColumnWidth,
      resizingMode,
    } = (typeof columnsResizing === 'boolean' ? undefined : columnsResizing) ?? {};

    const resizingColumnExtensions: ResizingExtension<RowType>[] = columns.map(({ name, minWidth, maxWidth }) => ({
      columnName: name,
      minWidth,
      maxWidth,
    }));

    const sortableColumns = columns.filter(({ sortingEnabled }) => Boolean(sortingEnabled));

    const sortingColumnExtensions: SortingExtension<RowType>[] = columns.map(
      ({ name, sortingEnabled = defaultSortingEnabled }) => ({
        columnName: name,
        sortingEnabled,
      }),
    );

    const staticOrder = new Map<ColumnName<RowType>, number>();
    columns.forEach(({ name, fixedOrder }, index) => {
      if (fixedOrder) {
        staticOrder.set(name, index);
      }
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Type '((props: CellProps) => ReactNode) | undefined' is not assignable to type '((row?: CellData<RowType> | undefined) => ReactNode) | undefined'.
    const tableColumnExtensions: ColumnExtension<RowType>[] = columns.map(
      ({ align, name, render, width, wordWrapEnabled }) => ({
        columnName: name,
        width,
        align,
        render,
        wordWrapEnabled,
      }),
    );

    const canResizeColumns = Boolean(columnsResizing);
    const canChangeSorting = sortableColumns.length > 0;

    const rowViews = isRowsConfig(rows)
      ? rows
      : (rows?.map((cells) => ({
          cells,
        })) as RowsConfig<RowType>) ?? [];

    return {
      canResizeColumns,
      canChangeSorting,
      canChangeVisibility,
      canReorderColumns,
      staticOrder,
      canFixColumns,
      canSelectRowsWithCheckbox,
      sortingColumnExtensions,
      resizingColumnExtensions,
      onUiStateChanged,
      defaultState: getDefaultState(props),
      maxColumnWidth,
      minColumnWidth,
      messages: completeWithDefaults(messages, defaultTableMessage),
      classes,
      columns,
      dataTestId,
      isEditMode,
      isLoading,
      onTableStateChanged,
      pageSizes: pagingProps?.pageSizes ?? defaultPageSizes,
      totalCount: pagingProps?.totalCount,
      canUsePagination: Boolean(
        pagingProps?.currentPage || pagingProps?.pageSize || pagingProps?.pageSizes?.length || pagingProps?.totalCount,
      ),
      resizingMode,
      rowProps,
      rows: rowViews,
      tableCode,
      tableColumnExtensions,
      tableConfig,
      updateColumnsConfig,
      updateData,
      isBordered,
      initialState,
      rowDetailConfig,
      customFooter,
      grouping,
      onResetTableSettings,
    };
  }, [props]);
