import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ChevronLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M15.7 5.29C16.09 5.68 16.09 6.31 15.7 6.7L10.41 12L15.7 17.29C16.09 17.68 16.09 18.31 15.7 18.7C15.31 19.09 14.68 19.09 14.29 18.7L8.29 12.7C7.9 12.31 7.9 11.68 8.29 11.29L14.29 5.29C14.68 4.9 15.31 4.9 15.7 5.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
