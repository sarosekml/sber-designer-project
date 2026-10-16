import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowCircleLeftFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M23 12C23 5.92 18.07 1 12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12ZM17 12C17 12.55 16.55 13 16 13L10.41 13L12.7 15.29C13.09 15.68 13.09 16.31 12.7 16.7C12.31 17.09 11.68 17.09 11.29 16.7L7.29 12.7C6.9 12.31 6.9 11.68 7.29 11.29L11.29 7.29C11.68 6.9 12.31 6.9 12.7 7.29C13.09 7.68 13.09 8.31 12.7 8.7L10.41 11L16 11C16.55 11 17 11.44 17 12Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
