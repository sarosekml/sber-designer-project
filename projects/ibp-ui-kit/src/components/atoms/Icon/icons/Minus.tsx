import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Minus = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M5 12L19 12" stroke="currentColor" strokeWidth="2.000000" strokeLinejoin="round" strokeLinecap="round"/>
    </SvgIcon>
  );
};
