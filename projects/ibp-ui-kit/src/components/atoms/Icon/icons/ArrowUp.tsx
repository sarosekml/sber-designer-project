import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowUp = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M11.29 4.29L4.29 11.29C3.89 11.68 3.89 12.31 4.29 12.7C4.68 13.1 5.31 13.1 5.7 12.7L11 7.41L11 19C11 19.56 11.43 20 12 20C12.55 20 13 19.56 13 19L13 7.41L18.29 12.7C18.68 13.1 19.31 13.1 19.7 12.7C20.1 12.31 20.1 11.68 19.7 11.29L12.7 4.29C12.51 4.09 12.27 4 12 4C11.72 4 11.48 4.09 11.29 4.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
