import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ARisk = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M15.62 15L17.08 18.39C17.3 18.9 17.87 19.14 18.39 18.91C18.9 18.69 19.13 18.12 18.91 17.6L13.52 5.01C13.38 4.69 13.17 4.43 12.86 4.25C12.75 4.19 12.64 4.14 12.53 4.1C12.36 4.05 12.18 4.02 12 4.02C11.81 4.02 11.63 4.05 11.46 4.1C11.35 4.14 11.24 4.19 11.13 4.25C10.97 4.35 10.83 4.46 10.72 4.6C10.62 4.72 10.53 4.86 10.47 5.01L5.08 17.6C4.86 18.12 5.09 18.69 5.6 18.91C6.12 19.14 6.69 18.9 6.91 18.39L8.37 15L15.62 15ZM14.76 13L12 6.53L9.23 13L14.76 13Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
