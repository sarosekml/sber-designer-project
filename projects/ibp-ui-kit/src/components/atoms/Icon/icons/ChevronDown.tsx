import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ChevronDown = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M6.7 8.29C6.31 7.89 5.68 7.89 5.29 8.29C4.89 8.68 4.89 9.31 5.29 9.7L11.29 15.7C11.48 15.9 11.72 15.99 12 15.99C12.27 15.99 12.51 15.9 12.7 15.7L18.7 9.7C19.1 9.31 19.1 8.68 18.7 8.29C18.31 7.89 17.68 7.89 17.29 8.29L12 13.58L6.7 8.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
