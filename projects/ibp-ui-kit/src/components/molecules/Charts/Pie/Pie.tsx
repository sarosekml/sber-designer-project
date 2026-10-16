import React, { FC } from 'react';
import { Pie as PieChart } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';

import { DataTestIdProps } from '@/types';
import { getDataTestId } from '@/utils';

export interface PieProps extends DataTestIdProps {
  data: ChartData<'pie'>;
  options?: ChartOptions<'pie'>;
  width?: number | string;
  height?: number | string;
}

export const Pie: FC<PieProps> = React.memo(({ data, options, width, height, dataTestId }: PieProps) => {
  console.log('options', options);
  return (
    <PieChart
      data-testid={getDataTestId(dataTestId, 'Pie')}
      data={data}
      options={{
        aspectRatio: 1.0,
        maintainAspectRatio: false,
        cutout: 0,
        plugins: {
          tooltip: {
            enabled: false,
          },
          legend: {
            display: false,
          },
        },
        ...options,
      }}
      width={width}
      height={height}
    />
  );
});
