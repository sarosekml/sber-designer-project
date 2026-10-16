import React from 'react';
import { TableRowDetail } from '@devexpress/dx-react-grid-material-ui';
import { TableCell } from '@mui/material';

import { IconButton } from '@/components/atoms';

export interface ToggleCellProps<RowData extends object> extends TableRowDetail.ToggleCellProps {
  showToggleIcon?: (row: RowData) => boolean;
}

export const ToggleCell = <RowData extends object>({
  row,
  expanded,
  onToggle,
  showToggleIcon,
}: ToggleCellProps<RowData>) => {
  const hasToggle = showToggleIcon?.(row?.data) ?? true;
  if (!hasToggle) {
    return <TableCell style={{ width: 0, padding: 0 }} />;
  }
  return (
    <TableCell>
      <IconButton
        size="lg"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        name={expanded ? 'ChevronUp' : 'ChevronDown'}
      />
    </TableCell>
  );
};
