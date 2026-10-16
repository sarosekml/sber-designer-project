import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const PointerRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M10.29 15.29C9.89 15.68 9.89 16.31 10.29 16.7C10.68 17.1 11.31 17.1 11.7 16.7L15.7 12.7C15.9 12.51 16 12.27 16 12C16 11.72 15.9 11.48 15.7 11.29L11.7 7.29C11.31 6.89 10.68 6.89 10.29 7.29C9.89 7.68 9.89 8.31 10.29 8.7L13.58 12L10.29 15.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
