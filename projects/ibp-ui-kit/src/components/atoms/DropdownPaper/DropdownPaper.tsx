import { Paper } from '@mui/material';
import { PaperProps } from '@mui/material/Paper/Paper';
import React, { memo } from 'react';
import { paperStyles } from './DropdownPaper.styles';

export const DropdownPaper = memo((props: PaperProps) => {
  return <Paper sx={paperStyles} elevation={2} {...props} />;
});

DropdownPaper.displayName = 'DropdownPaper';
