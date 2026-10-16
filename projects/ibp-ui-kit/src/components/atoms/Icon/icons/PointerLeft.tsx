import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const PointerLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M10.41 12L13.7 8.7C14.1 8.31 14.1 7.68 13.7 7.29C13.31 6.89 12.68 6.89 12.29 7.29L8.29 11.29C8.09 11.48 8 11.72 8 12C8 12.27 8.09 12.51 8.29 12.7L12.29 16.7C12.68 17.1 13.31 17.1 13.7 16.7C14.1 16.31 14.1 15.68 13.7 15.29L10.41 12Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
