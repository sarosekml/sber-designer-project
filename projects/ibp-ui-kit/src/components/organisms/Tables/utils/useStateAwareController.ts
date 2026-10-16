import { useMemo } from 'react';

import { ColumnName, FixedSide } from '@sber-ibp/core';
import { TableState, TableStateController } from '../Table/TableState';

/**
 * Add controller actions which uses the current state
 */
export const useStateAwareController = <
  RowType extends object,
  Filter extends object,
  ControllerType extends TableStateController<RowType, Filter>,
  StateType extends TableState<RowType, Filter> | undefined,
>(
  controller: ControllerType,
  tableState: StateType,
) => {
  return useMemo(
    () => ({
      ...controller,
      setFixedColumn: (columnName: ColumnName<RowType>, value: FixedSide | undefined) => {
        if (!tableState) return;

        const newColumns = new Map(tableState.fixedColumns);
        newColumns.set(columnName, value);
        return controller.setFixedColumns(newColumns);
      },
    }),
    [controller, tableState],
  );
};
