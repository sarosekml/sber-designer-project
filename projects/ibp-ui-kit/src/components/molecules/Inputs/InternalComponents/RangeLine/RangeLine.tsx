import React, { useMemo } from 'react';

import { SxBox } from '@/components/atoms/SxBox';

import { RangeLineWStyles } from './RangeLine.styles';
import { RangeLineProps } from './RangeLine.types';

export const RangeLine = ({ size, disabled }: RangeLineProps) => {
  const rangeLineSx = useMemo(() => RangeLineWStyles({ size, disabled }), [size, disabled]);

  return <SxBox sx={rangeLineSx}></SxBox>;
};
