import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Loader = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M24 12C24 15.01 22.88 17.76 21.04 19.87C19.07 22.15 16.42 23.49 13.65 23.88C10.67 24.3 7.78 23.57 5.44 22.04C2.92 20.4 1.22 17.96 0.45 15.27C-0.37 12.37 -0.05 9.42 1.14 6.89C2.42 4.16 4.6 2.14 7.16 1.01L7.96 2.84C5.67 3.86 3.94 5.63 2.95 7.74C1.88 10.01 1.74 12.48 2.38 14.73C3.06 17.14 4.58 19.1 6.53 20.37C8.63 21.74 11.07 22.22 13.37 21.9C15.86 21.55 18.01 20.32 19.54 18.56C21.19 16.67 21.99 14.33 22 12L24 12Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
