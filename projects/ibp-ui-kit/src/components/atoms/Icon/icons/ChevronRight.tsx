import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ChevronRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M8.29 5.29C8.68 4.9 9.31 4.9 9.7 5.29L15.7 11.29C16.09 11.68 16.09 12.31 15.7 12.7L9.7 18.7C9.31 19.09 8.68 19.09 8.29 18.7C7.9 18.31 7.9 17.68 8.29 17.29L13.58 12L8.29 6.7C7.9 6.31 7.9 5.68 8.29 5.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
