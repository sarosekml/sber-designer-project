import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M10.7 6.7L6.41 10.99L20 10.99C20.56 10.99 21 11.43 21 11.99C21 12.55 20.56 12.99 20 12.99L6.41 12.99L10.7 17.29C11.1 17.68 11.1 18.31 10.7 18.7C10.31 19.1 9.68 19.1 9.29 18.7L3.29 12.7C3.09 12.51 3 12.27 3 11.99C3 11.72 3.09 11.48 3.29 11.29L9.29 5.29C9.68 4.89 10.31 4.89 10.7 5.29C11.1 5.68 11.1 6.31 10.7 6.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
