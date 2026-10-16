import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const LayerSingle = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24" width="24" height="24">
      <path
        d="M2 12L11.64 16.82C11.77 16.88 11.83 16.91 11.9 16.93C11.96 16.94 12.03 16.94 12.09 16.93C12.16 16.91 12.22 16.88 12.35 16.82L22 12L12.35 7.17C12.22 7.11 12.16 7.08 12.09 7.06C12.03 7.05 11.96 7.05 11.9 7.06C11.83 7.08 11.77 7.11 11.64 7.17L2 12Z"
        stroke="currentColor"
        strokeOpacity="1.000000"
        strokeWidth="2.000000"
        strokeLinejoin="round"
        fill="none"
      />
    </SvgIcon>
  );
};
