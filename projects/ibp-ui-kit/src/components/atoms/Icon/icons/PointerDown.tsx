import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const PointerDown = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M8.7 10.29C8.31 9.89 7.68 9.89 7.29 10.29C6.89 10.68 6.89 11.31 7.29 11.7L11.29 15.7C11.48 15.9 11.72 15.99 12 15.99C12.27 15.99 12.51 15.9 12.7 15.7L16.7 11.7C17.1 11.31 17.1 10.68 16.7 10.29C16.31 9.89 15.68 9.89 15.29 10.29L12 13.58L8.7 10.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
