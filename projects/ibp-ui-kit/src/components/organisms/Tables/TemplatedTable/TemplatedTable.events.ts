import { TableStateControllerEvents } from '../Table/TableState/TableState.events';

import { TemplatedTableStatePart } from './TemplatedTable.types';

export interface TableRowUpdateData<RowType extends object> {
  index: number;
  data: RowType;
}

/**
 * Description of the all events available for table
 * @TODO Add description for each event
 */
export interface TemplatedTableStateControllerEvents<
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
> extends TableStateControllerEvents<RowType, Filter> {
  refetchData: void;
  updateTableRow: TableRowUpdateData<RowDataType>;
  addTableRow: RowDataType;
  removeTableRow: number;
}

export interface TemplatedTableStateEvents {
  tableStateResponse: {
    requestId?: string;
    tableState: TemplatedTableStatePart;
  };
  tableStateChanged: TemplatedTableStatePart;
}
