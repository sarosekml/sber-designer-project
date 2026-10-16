import React, { memo, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Table } from '@devexpress/dx-react-grid-material-ui';

import { useEventApi } from '@sber-ibp/core';

import { SxBox } from '@/components/atoms';

import { TableTestKeys } from '../../Table.const';
import { Row, RowView } from '../../TableProps/TableRow.types';

import { TableRowContext } from './TableRow.context';
import { useRowStyles } from './TableRow.styles';
import { RowEvents } from './TableRow.types';

export const makeRowHoverEventChannel = (tableCode: string) => `RowHoverChannel_${tableCode}`;

export const TableRow = memo((props: Table.DataRowProps) => {
  const [forceHover, setForceHover] = useState(false);
  const { tableCode, rowProps, selectedRowIndex, setSelectedRowIndex, defaultColorSchema } =
    useContext(TableRowContext);
  const rowRef = useRef<HTMLTableRowElement>();

  const isHoverInUse = Boolean(rowProps?.hoverConfig);
  const { trigger } = useEventApi<RowEvents>(makeRowHoverEventChannel(tableCode));

  const { onRowClick, onDoubleRowClick } = rowProps || {};
  const tableRowIndex = props?.tableRow?.rowId as number | undefined;
  const isIncorrectTableRowIndex = typeof tableRowIndex !== 'number';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowConfig = props.row as RowView<any>;
  /**
   * @TODO Investigate who uses this prop
   */
  const isHidden = Boolean((rowConfig.cells as { hidden?: { data?: boolean } }).hidden?.data);
  const colorSchema = useMemo(
    () => ({
      ...defaultColorSchema,
      ...rowConfig.colorSchema,
    }),
    [defaultColorSchema, rowConfig],
  );

  /** @todo Crush logic with selecting after sorting - need to research this issue */
  const isSelectedRow = tableRowIndex === selectedRowIndex;

  const onClick = useCallback(() => {
    if (isIncorrectTableRowIndex || !setSelectedRowIndex || !onRowClick) return;
    setSelectedRowIndex(tableRowIndex);
    // @TODO we should provide index first and second the row itself (usually no need in row actually)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRowClick(rowConfig.cells as Row<any>, tableRowIndex);
  }, [rowConfig, tableRowIndex, setSelectedRowIndex, isIncorrectTableRowIndex, onRowClick]);

  const onDoubleClick = useCallback(() => {
    if (isIncorrectTableRowIndex || !setSelectedRowIndex || !onDoubleRowClick) return;
    setSelectedRowIndex(tableRowIndex);
    // @TODO we should provide index first and second the row itself (usually no need in row actually)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDoubleRowClick(rowConfig.cells as Row<any>, tableRowIndex);
  }, [rowConfig, tableRowIndex, setSelectedRowIndex, isIncorrectTableRowIndex, onDoubleRowClick]);

  const keyOption = (props?.row?.key ?? props?.tableRow?.key ?? props?.tableRow?.rowId ?? '').replace(
    'Symbol(data)_',
    '',
  );

  const rowStyles = useRowStyles({
    colorSchema,
    isSelectable: Boolean(onRowClick || onDoubleRowClick),
    isSelectedRow,
    isHidden,
    forceHover,
  });

  const onMouseOver = useCallback(() => {
    const target = rowRef.current;
    if (!target || tableRowIndex === undefined) return;

    trigger('hover', {
      ref: target,
      colorSchema,
      data: rowConfig.cells,
      index: tableRowIndex,
      key: keyOption,
      setForceHovered: setForceHover,
    });
  }, [colorSchema, keyOption, rowConfig.cells, tableRowIndex, trigger]);

  const onMouseLeave = useCallback(() => {
    const target = rowRef.current;
    if (!target || tableRowIndex === undefined) return;

    trigger('blur', keyOption);
  }, [keyOption, tableRowIndex, trigger]);

  return (
    <SxBox
      {...props}
      component="tr"
      ref={rowRef}
      key={keyOption}
      sx={rowStyles}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseOver={isHoverInUse ? onMouseOver : undefined}
      onMouseLeave={isHoverInUse ? onMouseLeave : undefined}
      data-testid={`${TableTestKeys.tableRowKey}_${keyOption}`}
    >
      {props.children}
    </SxBox>
  );
});

TableRow.displayName = 'TableRow';
