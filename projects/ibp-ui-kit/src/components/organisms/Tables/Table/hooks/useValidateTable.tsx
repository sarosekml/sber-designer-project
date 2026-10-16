import { useDebouncedEffect } from '@sber-ibp/core';

import { Column, ColumnsConfig, defaultPageSize, TableInternalPlainModel } from '../TableProps';
import { DataFetchingState, DataFetchingStateController, UiState } from '../TableState';

const debouncingTime = 100;

/**
 * Performs lightweight validation.
 */
const validateUiState = <RowType extends object>(
  columns: Column<RowType>[],
  { order, columnWidths }: UiState<RowType>,
) => {
  if (columns.length !== order.length) {
    console.error(
      'Column order as the state parameter should include all column names from the original configuration!',
    );
  }
  if (columns.length !== columnWidths.length) {
    console.error(
      'Column widths as the state parameter should include widths for all columns from the original configuration!',
    );
  }
};

interface Props<RowType extends object, Filter extends object> {
  columns: ColumnsConfig<RowType>;
  skip: boolean | undefined;
  uiState: UiState<RowType>;
  dataFetchingState: DataFetchingState<RowType, Filter>;
  dataFetchingStateController: DataFetchingStateController<RowType, Filter>;
}

export const useValidateTable = <RowType extends object, Filter extends object>(
  { uiState, skip, columns, dataFetchingState, dataFetchingStateController }: Props<RowType, Filter>,
  { totalCount }: TableInternalPlainModel<RowType, Filter>,
) => {
  // Validate state
  useDebouncedEffect(
    () => {
      if (skip) return;
      validateUiState(columns, uiState);
    },
    [uiState, skip],
    debouncingTime,
  );

  useDebouncedEffect(
    () => {
      if (skip) return;
      const maxAvailablePage =
        totalCount || totalCount === 0
          ? Math.max(Math.ceil(totalCount / (dataFetchingState.pageSize ?? defaultPageSize)) - 1, 0)
          : Infinity;

      if (maxAvailablePage < dataFetchingState.currentPage) {
        dataFetchingStateController.setCurrentPage(maxAvailablePage);
      }
    },
    [dataFetchingState, skip, totalCount],
    debouncingTime,
  );
};
