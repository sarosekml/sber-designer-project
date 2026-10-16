import { ChartData } from 'chart.js';

import { theme } from '@/styles';

const labels = [...new Array(25)].fill('22.06.2023', 0, 25);

const data = [10, 15, 13, 11, 14, 12, 11, 10, 14, 15, 16, 12, 11, 12, 15, 14, 12, 13, 15, 16, 12, 10, 12, 10, 11];
const data2 = [
  -10, -15, -13, -11, -14, -12, -11, -10, -14, -15, -16, -12, -11, -12, -15, -14, -12, -13, -15, -16, -12, -10, -12,
  -10, -11,
];
const data3 = [2, 12, 13, 17, 19, 14, 13, 14, 10, 10, 12, 13, 15, 5, 6, 5, 8, 11, 12, 7, 8, 9, 10, 12, 6];

const borderRadius = {
  topRight: 4,
  bottomLeft: 4,
  topLeft: 4,
  bottomRight: 4,
};

const { CGreen, CGreenDark, CRed, CRedDark, CBlue } = theme.palette.Chart;

export const chartData: ChartData<'bar' | 'line'> = {
  labels: labels,
  datasets: [
    {
      type: 'line',
      label: 'Остаток',
      data: data3,
      borderWidth: 2,
      borderColor: CBlue,
    },
    {
      label: 'Поступление',
      data: data,
      stack: 'stack 0',
      borderRadius: borderRadius,
      borderSkipped: 'bottom',
      backgroundColor: CGreen,
      hoverBackgroundColor: CGreenDark,
      barThickness: 24,
    },
    {
      label: 'Списание',
      data: data2,
      stack: 'stack 0',
      borderRadius: borderRadius,
      borderSkipped: 'bottom',
      backgroundColor: CRed,
      hoverBackgroundColor: CRedDark,
      barThickness: 24,
    },
  ],
};
