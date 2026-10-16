import React, { memo, useContext, useMemo } from 'react';
import { Table } from '@devexpress/dx-react-grid-material-ui';

import { SxBox } from '@/components/atoms';

import { TableTestKeys } from '../../Table.const';
import { ColumnName, RowCellFormat } from '../../TableProps';
import { TableEditMark } from '../TableEditMark';
import { TableRowContext } from '../TableRow/TableRow.context';

import { cellContentSx, useCellStyles } from './TableCell.styles';
import { TableCellProps } from './TableCell.types';

const isTableRowFormat = <RowData extends object>(
  cellData: RowCellFormat<RowData> | React.ReactNode,
): cellData is RowCellFormat<RowData> => {
  return (
    typeof cellData === 'object' &&
    cellData !== null &&
    (cellData['render'] || cellData['editRender'] || cellData['exportRender'])
  );
};

export const TableCell = memo(<RowData extends object>(props: TableCellProps<RowData>) => {
  const { selectedRowIndex, isEditMode } = useContext(TableRowContext);
  const columnKey = props.column.name as ColumnName<RowData>;
  const tableColumnKey = props.tableColumn.key.replace('Symbol(data)_', '');
  const testId = `${TableTestKeys.tableCellKey}_${tableColumnKey}`;

  const cellData = props.row.cells[columnKey];
  const isComplexConfig = isTableRowFormat<RowData>(cellData);
  const colorSchema = useMemo(() => (isComplexConfig ? cellData.colorSchema : undefined), [cellData, isComplexConfig]);
  const hasEditMark = isComplexConfig ? cellData.hasEditMark : undefined;
  const editMarkTooltipTitle = isComplexConfig ? cellData.editMarkTooltipTitle : undefined;
  const cellSx = useCellStyles(colorSchema);

  const hasOwnRenderMethod = Boolean(cellData && Object.keys(cellData).includes('render'));
  const isSelectedRow = props.tableRow.rowId === selectedRowIndex || (isComplexConfig && !!cellData.selected);
  const shouldRenderEditComponent = !!(
    isEditMode &&
    isSelectedRow &&
    isComplexConfig &&
    Object.keys(cellData).includes('editRender')
  );

  const isEditRender = hasOwnRenderMethod && shouldRenderEditComponent;
  let reactNode: React.ReactNode;
  if (isComplexConfig) {
    if (isEditRender && cellData.editRender) {
      reactNode = cellData.editRender(cellData.data);
    } else {
      reactNode = cellData.render?.(cellData.data);
    }
  } else {
    reactNode = cellData;
  }
  const reactElement = React.isValidElement(reactNode) ? reactNode : <SxBox sx={cellContentSx}>{[reactNode]}</SxBox>;

  if (isTableRowFormat<RowData>(cellData) && cellData.skipRender) return null;

  const isAfterRowspan = isTableRowFormat<RowData>(cellData) && cellData.isAfterRowspan;

  return (
    <Table.Cell
      {...props}
      sx={cellSx}
      rowSpan={isTableRowFormat<RowData>(cellData) ? cellData.rowSpan : undefined}
      key={columnKey}
      data-testid={testId}
      data-columnkey={columnKey}
      data-first-after-rowspan={isAfterRowspan}
      data-edit-cell={isEditRender}
    >
      {reactElement}
      {hasEditMark && <TableEditMark editMarkTooltipTitle={editMarkTooltipTitle} />}
    </Table.Cell>
  );
});

TableCell.displayName = 'TableCell';
