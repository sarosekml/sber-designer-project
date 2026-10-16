import React, { memo, ReactNode } from 'react';
import { Paper, useTheme } from '@mui/material';

import { Divider, SxBox, Text } from '@/components/atoms';

import { getInputAutocompleteDropdownPapperStyles } from '../InputAutocompleteStyles/InputAutocompleteOptions.styles';

import { inputAutocompleteDropdownText } from './InputAutocompleteDropdown.const';
import { getSelectAllOptionStyles as selectAllOptionStyles } from './InputAutocompleteDropdown.styles';

interface InputAutocompleteDropdownPaperProps {
  children?: ReactNode;
  clearAllCallback: () => void;
  hasSelectAll: boolean;
  isSelectedAll: boolean;
  multiple?: boolean;
  selectAllCallback: () => void;
}

export const InputAutocompleteDropdownPaper = memo(
  ({
    children,
    clearAllCallback,
    hasSelectAll,
    isSelectedAll,
    multiple = false,
    selectAllCallback,
  }: InputAutocompleteDropdownPaperProps) => {
    const theme = useTheme();

    return (
      <Paper sx={getInputAutocompleteDropdownPapperStyles(hasSelectAll)}>
        {hasSelectAll && multiple ? (
          <SxBox sx={{ paddingTop: theme.spacing(3) }}>
            <SxBox
              onClick={isSelectedAll ? clearAllCallback : selectAllCallback}
              onMouseDown={(event) => event.preventDefault()}
              sx={selectAllOptionStyles}
            >
              <Text type={'BodyMReg'} color={theme.palette.Text.TextPrimary}>
                {isSelectedAll ? inputAutocompleteDropdownText.removeAll : inputAutocompleteDropdownText.selectAll}
              </Text>
            </SxBox>
            <Divider orientation={'horizontal'} flexItem={false} />
          </SxBox>
        ) : null}

        {children}
      </Paper>
    );
  },
);

InputAutocompleteDropdownPaper.displayName = 'InputAutocompleteDropdownPaper';
