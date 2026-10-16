import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ChevronRightDouble = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M6.7 6.29C6.31 5.9 5.68 5.9 5.29 6.29C4.9 6.68 4.9 7.31 5.29 7.7L9.58 12L5.29 16.29C4.9 16.68 4.9 17.31 5.29 17.7C5.68 18.09 6.31 18.09 6.7 17.7L11.7 12.7C12.09 12.31 12.09 11.68 11.7 11.29L6.7 6.29ZM13.7 6.29C13.31 5.9 12.68 5.9 12.29 6.29C11.9 6.68 11.9 7.31 12.29 7.7L16.58 12L12.29 16.29C11.9 16.68 11.9 17.31 12.29 17.7C12.68 18.09 13.31 18.09 13.7 17.7L18.7 12.7C19.09 12.31 19.09 11.68 18.7 11.29L13.7 6.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
