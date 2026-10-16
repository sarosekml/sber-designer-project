import React from 'react';
import { Bar as BarChart } from 'react-chartjs-2';

import { Grid } from '@/components/atoms';
import { getDataTestId } from '@/utils';

import { useBar, useBarOptions } from './Bar.hooks';
import { BarProps } from './Bar.types';

export const Bar = React.memo(({ data, params, options, dataTestId, onClick, width, height }: BarProps) => {
  const barConfig = useBarOptions(data, params);
  const { chartRef, onClickHandler } = useBar(onClick);

  return (
    <Grid width={width} height={height}>
      <BarChart
        data-testid={getDataTestId(dataTestId, 'Bar')}
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        data={data}
        options={options ?? barConfig}
        ref={chartRef}
        onClick={onClickHandler}
      />
    </Grid>
  );
});
