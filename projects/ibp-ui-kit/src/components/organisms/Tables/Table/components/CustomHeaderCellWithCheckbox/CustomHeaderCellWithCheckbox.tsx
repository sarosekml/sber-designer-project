import React, { memo } from 'react';
import { IndeterminateCheckBox } from '@mui/icons-material';
import { Checkbox, TableCell } from '@mui/material';

interface Props {
  disabled: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (checked: boolean) => void;
}

export const CustomHeaderCellWithCheckbox = memo(({ disabled, allSelected, someSelected, onToggle }: Props) => {
  return (
    <TableCell style={{ paddingLeft: 18 }}>
      <Checkbox
        size="small"
        disabled={disabled}
        indeterminate={someSelected}
        indeterminateIcon={<IndeterminateCheckBox />}
        checked={allSelected}
        onChange={() => onToggle(!someSelected && !allSelected)}
      />
    </TableCell>
  );
});

CustomHeaderCellWithCheckbox.displayName = 'CustomHeaderCellWithCheckbox';
