import React from 'react';
import { Grid } from '@mui/material';

import { TooltipItems } from './Counter.types';

export const cutTooltipData = (tooltipItems: string[], cutLength: number): string[] | null =>
  tooltipItems?.length <= cutLength ? null : tooltipItems.slice(cutLength);

export const prepareArrayForColumnView = (tooltipItems: string[] | null): React.ReactNode => {
  return (
    <Grid container flexDirection={'column'} gap={2}>
      {tooltipItems?.map((item, key) => {
        return (
          <Grid item key={key}>
            {item}
          </Grid>
        );
      })}
    </Grid>
  );
};

export const prepareArrayForRowView = (tooltipItems: string[] | null): React.ReactNode =>
  tooltipItems && tooltipItems.join(', ');

export const convertDictionaryToString = (tooltipItems: TooltipItems[]): React.ReactNode =>
  tooltipItems?.map((el) => el.name ?? el.code)?.join(', ');
