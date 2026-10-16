import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowUpLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M5.99 7L5.99 17C5.99 17.56 6.43 18 6.99 18C7.55 18 7.99 17.56 7.99 17L7.99 9.41L16.29 17.7C16.68 18.1 17.31 18.1 17.7 17.7C18.1 17.31 18.1 16.68 17.7 16.29L9.41 8L16.99 8C17.55 8 17.99 7.56 17.99 7C17.99 6.43 17.55 6 16.99 6L6.99 6C6.72 6 6.48 6.09 6.29 6.29C6.09 6.48 5.99 6.72 5.99 7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
