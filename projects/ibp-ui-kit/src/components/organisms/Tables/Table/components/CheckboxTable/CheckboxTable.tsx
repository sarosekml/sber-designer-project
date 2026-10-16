import React, { memo } from 'react';
import { Table as MUITable, TableBody, TableContainer, TableHead } from '@mui/material';

import { getDataTestId } from '@/utils';

import { muiTableStyles, tableContainerStyles } from './CheckboxTable.styles';
import { CheckboxTableProps } from './CheckboxTable.types';
import { CheckboxTableRow } from './CheckboxTableRow';

const ROOT = 'CheckboxTable';

export const CheckboxTable = memo(
  ({ checkboxSize = 'md', data, isAllChecked, onChange, onChangeAll, title, dataTestId }: CheckboxTableProps) => {
    return (
      <TableContainer sx={tableContainerStyles} data-testid={getDataTestId(dataTestId, ROOT)}>
        <MUITable stickyHeader aria-label="sticky table" sx={muiTableStyles}>
          <TableHead>
            <CheckboxTableRow
              label={title}
              checked={isAllChecked}
              onChange={onChangeAll}
              checkboxSize={checkboxSize}
              isHeaderRow
            />
          </TableHead>
          {!Array.isArray(data) ? (
            data
          ) : (
            <TableBody>
              {data.map((item) => (
                <CheckboxTableRow
                  key={item.label}
                  label={item.label}
                  checked={item.checked}
                  checkboxSize={checkboxSize}
                  onChange={onChange}
                />
              ))}
            </TableBody>
          )}
        </MUITable>
      </TableContainer>
    );
  },
);

CheckboxTable.displayName = ROOT;
