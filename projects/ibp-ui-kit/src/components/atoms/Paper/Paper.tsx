import React, { memo, useMemo } from 'react';
import { Paper as MaterialPaper } from '@mui/material';

import { getDataTestId, mergeSx } from '@/utils';

import { paperStyles } from './Paper.styles';
import { PaperTypes } from './Paper.types';

export const Paper = memo<PaperTypes>(({ elevation = 0, sx, variant, dataTestId = 'Paper', ...props }) => {
  const styles = useMemo(() => mergeSx(paperStyles, sx), [sx]);
  return (
    <MaterialPaper data-testid={getDataTestId(dataTestId, variant)} elevation={elevation} sx={styles} {...props} />
  );
});
Paper.displayName = 'Paper';
