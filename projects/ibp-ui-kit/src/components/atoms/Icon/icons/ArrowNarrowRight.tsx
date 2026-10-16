import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M14.7 5.29C14.31 4.89 13.68 4.89 13.29 5.29C12.89 5.68 12.89 6.31 13.29 6.7L17.58 10.99L4 10.99C3.43 10.99 3 11.43 3 11.99C3 12.55 3.43 12.99 4 12.99L17.58 12.99L13.29 17.29C12.89 17.68 12.89 18.31 13.29 18.7C13.68 19.1 14.31 19.1 14.7 18.7L20.7 12.7C20.9 12.51 21 12.27 21 11.99C21 11.72 20.9 11.48 20.7 11.29L14.7 5.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
