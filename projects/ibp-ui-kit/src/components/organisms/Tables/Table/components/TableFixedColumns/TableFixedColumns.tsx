import React, { memo, useMemo } from 'react';
import { TableFixedColumns as NativeFixedColumns } from '@devexpress/dx-react-grid-material-ui';

import { FixedColumnsInfo } from '../../TableProps';

interface Props<RowData extends object> {
  fixedColumns: FixedColumnsInfo<RowData>;
}

const TableFixedColumnsComponent = <RowData extends object>({ fixedColumns }: Props<RowData>) => {
  const { leftColumns, rightColumns } = useMemo(() => {
    const entries = Array.from(fixedColumns.entries());
    return {
      leftColumns: entries.filter(([, fixedSide]) => fixedSide === 'left').map(([name]) => name),
      rightColumns: entries.filter(([, fixedSide]) => fixedSide === 'right').map(([name]) => name),
    };
  }, [fixedColumns]);

  return <NativeFixedColumns leftColumns={leftColumns} rightColumns={rightColumns} />;
};

export const TableFixedColumns = memo(TableFixedColumnsComponent) as typeof TableFixedColumnsComponent & {
  displayName: string;
};
TableFixedColumns.displayName = 'TableFixedColumns';
