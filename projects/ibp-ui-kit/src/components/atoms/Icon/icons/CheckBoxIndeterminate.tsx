import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const CheckBoxIndeterminate = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M3.91 20.37C4.14 20.47 4.39 20.51 4.66 20.51L18.66 20.51C19.21 20.51 19.68 20.32 20.07 19.93C20.46 19.54 20.66 19.06 20.66 18.51L20.66 4.51C20.66 4.25 20.61 4 20.52 3.77C20.42 3.52 20.27 3.3 20.07 3.1C19.68 2.71 19.21 2.51 18.66 2.51L4.66 2.51C4.39 2.51 4.14 2.56 3.91 2.65C3.67 2.75 3.45 2.9 3.25 3.1C3.05 3.3 2.9 3.52 2.8 3.77C2.7 4 2.66 4.25 2.66 4.51L2.66 18.51C2.66 19.06 2.85 19.54 3.25 19.93C3.45 20.13 3.67 20.28 3.91 20.37ZM16.66 12.51L6.66 12.51L6.66 10.51L16.66 10.51L16.66 12.51Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
