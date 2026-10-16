import React, { memo } from 'react';

import { Grid } from '@mui/material';
import { BadgeCounterSize, useBadgeCounterStyles } from './BadgeCounter.styles';

export interface BadgeCounterProps {
  counter: number;
  size: BadgeCounterSize;
}

const ROOT = 'BadgeCounter';

export const BadgeCounter = memo(({ counter, size }: BadgeCounterProps) => {
  const sx = useBadgeCounterStyles({ size });

  if (counter === 0) return null;

  if (size === 'sm') {
    return <Grid sx={sx}>{counter < 100 ? counter : '99+'}</Grid>;
  }

  return <Grid sx={sx}>{counter}</Grid>;
});

BadgeCounter.displayName = ROOT;
