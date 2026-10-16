import React, { memo } from 'react';
import { Divider as MuiDivider } from '@mui/material';
import { getDividerSx } from './Divider.styles';
import { DividerProps } from './Divider.types';

export const Divider = memo(({ color, orientation = 'horizontal', flexItem = false }: DividerProps) => {
  const sx = getDividerSx({ color });

  return <MuiDivider sx={sx} orientation={orientation} flexItem={flexItem} />;
});
