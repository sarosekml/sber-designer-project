import React, { memo } from 'react';
import { Grid } from '@mui/material';

import { Tooltip } from '@/components/atoms';

import { editMarkSx, rootSx } from './TableEditMark.const';

interface Props {
  editMarkTooltipTitle?: string;
}

export const TableEditMark = memo(({ editMarkTooltipTitle }: Props) => {
  return (
    <Grid sx={rootSx}>
      <Tooltip title={editMarkTooltipTitle}>
        <Grid height={12} width={12} sx={editMarkSx} />
      </Tooltip>
    </Grid>
  );
});

TableEditMark.displayName = 'TableEditMark';
