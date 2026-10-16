import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowCircleRightFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1C5.92 1 1 5.92 1 12ZM7 12C7 11.44 7.44 11 8 11L13.58 11L11.29 8.7C10.9 8.31 10.9 7.68 11.29 7.29C11.68 6.9 12.31 6.9 12.7 7.29L16.7 11.29C17.09 11.68 17.09 12.31 16.7 12.7L12.7 16.7C12.31 17.09 11.68 17.09 11.29 16.7C10.9 16.31 10.9 15.68 11.29 15.29L13.58 13L8 13C7.44 13 7 12.55 7 12Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
