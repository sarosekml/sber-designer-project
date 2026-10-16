import { Table } from '@devexpress/dx-react-grid-material-ui';

import { RowView } from '@/components/organisms/Tables/Table';

export interface TableCellProps<RowData extends object> extends Table.DataCellProps {
  row: RowView<RowData>;
}
