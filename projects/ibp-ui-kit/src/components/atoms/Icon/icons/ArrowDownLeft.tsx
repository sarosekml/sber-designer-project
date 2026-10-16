import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowDownLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M17.7 7.7L9.41 16L16.99 16C17.55 16 17.99 16.43 17.99 17C17.99 17.55 17.55 18 16.99 18L6.99 18C6.72 18 6.48 17.9 6.29 17.7C6.09 17.51 5.99 17.27 5.99 17L5.99 7C5.99 6.43 6.43 6 6.99 6C7.55 6 7.99 6.43 7.99 7L7.99 14.58L16.29 6.29C16.68 5.89 17.31 5.89 17.7 6.29C18.1 6.68 18.1 7.31 17.7 7.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
