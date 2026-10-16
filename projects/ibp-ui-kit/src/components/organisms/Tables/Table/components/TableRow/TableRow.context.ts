import { createContext } from 'react';

import { RowProps, RowsConfig, TableColorSchema, TableMessages } from '../../TableProps';
import { ScrollState } from '../../TableState';

export interface TableRowContextData<RowType extends object> {
  rowProps?: RowProps<RowType>;
  selectedRowIndex?: number;
  setSelectedRowIndex?: (newIndex?: number) => void;
  setScroll?: (scroll?: ScrollState) => void;
  rows?: RowsConfig<RowType>;
  scroll?: ScrollState;
  isEditMode?: boolean;
  isLoading?: boolean;
  messages?: TableMessages;
  defaultColorSchema: TableColorSchema;
  tableCode: string;
}

export const TableRowContext = createContext<TableRowContextData<any>>({
  defaultColorSchema: {},
  tableCode: '',
});
