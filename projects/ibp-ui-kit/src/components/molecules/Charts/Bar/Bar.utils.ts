import { Point } from 'chart.js';

export const getMax = (values: (number | Point | null)[]) => {
  const items = values.filter((item) => typeof item === 'number' && item !== null) as number[];
  return Math.max(...items);
};

export const getMin = (values: (number | Point | null)[]) => {
  const items = values.filter((item) => typeof item === 'number' && item !== null) as number[];
  return Math.min(...items);
};
