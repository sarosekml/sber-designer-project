import { useMemo } from 'react';
import { useTableController } from './useTableController';
import { useTableState } from './useTableState';
import { useStateAwareController } from './useStateAwareController';

/**
 * The hook returns the current state for the table with
 * provided tableCode and the controller to update this state.
 */
export const useTable = <RowType extends object, Filter extends object>(tableCode: string | undefined) => {
  const tableState = useTableState<RowType, Filter>(tableCode);
  const controller = useTableController<RowType, Filter>(tableCode);
  const extendedController = useStateAwareController<RowType, Filter, typeof controller, typeof tableState>(
    controller,
    tableState,
  );
  return useMemo(
    () => ({
      tableState,
      controller: extendedController,
    }),
    [tableState, extendedController],
  );
};
