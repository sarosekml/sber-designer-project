import React, { memo } from 'react';
import { TableCell, TableRow } from '@mui/material';

import { InputCheckbox } from '@/components/molecules/Inputs';
import { mergeSx } from '@/utils';

import {
  cellStyles,
  checkboxCellStyles,
  checkboxHeaderCellStyles,
  labelStyles,
  rowStyles,
} from './CheckboxTableRow.styles';
import { CheckboxTableRowProps } from './CheckboxTableRow.types';

export const CheckboxTableRow = memo(
  ({ label, checked, isHeaderRow = false, disabled, checkboxSize = 'md', onChange }: CheckboxTableRowProps) => {
    return (
      <TableRow sx={rowStyles} onClick={!disabled && onChange ? onChange : undefined}>
        <TableCell
          size="medium"
          sx={mergeSx(cellStyles, checkboxCellStyles, isHeaderRow && checkboxHeaderCellStyles, labelStyles)}
        >
          <InputCheckbox size={checkboxSize} checked={checked} name={label} label={label} disabled={disabled} />
        </TableCell>
      </TableRow>
    );
  },
);
