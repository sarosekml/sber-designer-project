import { FC } from 'react';

import {
  TemplatedRowProps,
  TemplatedTableProps,
  TemplatedTableState,
  TemplatedTableStateController,
} from '../TemplatedTable/TemplatedTable.types';

export interface BrowsableTablePreviewComponentProps<
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
> {
  controller: TemplatedTableStateController<RowType, Filter, RowDataType>;
  selectedRow: RowDataType;
  tableState: TemplatedTableState<RowType, Filter>;
  index: number;
}

export type PreviewComponent<RowType extends object, Filter extends object, RowDataType extends object = RowType> = FC<
  BrowsableTablePreviewComponentProps<RowType, Filter, RowDataType>
>;

export type BrowsableTableProps<
  RowType extends object,
  Filter extends object,
  RowDataType extends object = RowType,
> = Omit<TemplatedTableProps<RowType, Filter, RowDataType>, 'rowProps' | 'tableCode'> & {
  tableCode: string;
  Preview: PreviewComponent<RowType, Filter, RowDataType>;
  height?: number | string;
  rowProps?: Omit<TemplatedRowProps<RowDataType>, 'onRowClick'>;
  shouldHidePreviewOnStateChanged?: boolean;
};
