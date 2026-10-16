import { useMemo } from 'react';

import { uuid } from '@sber-ibp/core';

import {
  RowProps,
  RowsConfig,
  TableMessages,
  useTableColorSchema,
} from '@/components/organisms/Tables/Table/TableProps';

import { ScrollState } from '../../TableState';

import { TableRowContextData } from './TableRow.context';

export interface TableRowContextProps<RowType extends object> {
  tableCode?: string;
  selectedRowIndex: number | undefined;
  setSelectedRowIndex: (selectedRowIndex?: number) => void;
  setScroll?: (scroll?: ScrollState) => void;
  rows?: RowsConfig<RowType>;
  scroll?: ScrollState;
  messages: TableMessages;
  isEditMode: boolean;
  rowProps?: RowProps<RowType>;
  isLoading?: boolean;
}

/**
 * There is no ability to pass additional parameters to the table row
 * as props so we pass it through the context. We also use the same context
 * for TableCell's.
 */
export const useTableRowContext = <RowType extends object>({
  isEditMode,
  isLoading,
  messages,
  rowProps,
  selectedRowIndex,
  setSelectedRowIndex,
  tableCode,
  setScroll,
  scroll,
  rows,
}: TableRowContextProps<RowType>): TableRowContextData<RowType> => {
  const defaultTableCode = useMemo(() => uuid(), []);
  const defaultColorSchema = useTableColorSchema();

  return useMemo(
    () => ({
      defaultColorSchema,
      isEditMode,
      isLoading,
      messages,
      rowProps,
      selectedRowIndex,
      setSelectedRowIndex,
      setScroll,
      scroll,
      rows,
      tableCode: tableCode ?? defaultTableCode,
    }),
    [
      defaultColorSchema,
      defaultTableCode,
      isEditMode,
      isLoading,
      messages,
      rowProps,
      selectedRowIndex,
      setSelectedRowIndex,
      tableCode,
      setScroll,
      scroll,
      rows,
    ],
  );
};
