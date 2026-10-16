import { useMemo } from 'react';
import { useTemplatedTableController } from './useTemplatedTableController';
import { useTemplateTableState } from './useTemplatedTableState';
import { useStateAwareController } from './useStateAwareController';

export const useTemplatedTable = <RowType extends object, Filter extends object, RowDataType extends object = RowType>(
  tableCode: string | undefined,
) => {
  const tableState = useTemplateTableState<RowType, Filter>(tableCode);
  const controller = useTemplatedTableController<RowType, Filter, RowDataType>(tableCode);
  const extendedController = useStateAwareController<RowType, Filter, typeof controller, typeof tableState>(
    controller,
    tableState,
  );

  return useMemo(
    () => ({
      controller: extendedController,
      tableState,
    }),
    [tableState, extendedController],
  );
};
