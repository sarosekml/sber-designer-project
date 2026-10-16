import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowUpRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M7 6L17 6C17.27 6 17.51 6.09 17.7 6.29C17.9 6.48 18 6.72 18 7L18 17C18 17.56 17.56 18 17 18C16.44 18 16 17.56 16 17L16 9.41L7.7 17.7C7.31 18.1 6.68 18.1 6.29 17.7C5.89 17.31 5.89 16.68 6.29 16.29L14.58 8L7 8C6.44 8 6 7.56 6 7C6 6.43 6.44 6 7 6Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
