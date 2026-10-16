import React, { memo } from 'react';

import { Grid } from '@/components/atoms';

import { useHoverTableTemplateSx } from './RowHover.styles';
import { RowHoverTemplateProps } from './RowHover.types';

export const RowHoverTemplate = memo(({ colorSchema, stickTo, children }: RowHoverTemplateProps) => {
  const sx = useHoverTableTemplateSx(colorSchema, stickTo);
  return (
    <Grid container sx={sx}>
      <Grid item>{children}</Grid>
    </Grid>
  );
});

RowHoverTemplate.displayName = 'RowHoverTemplate';
