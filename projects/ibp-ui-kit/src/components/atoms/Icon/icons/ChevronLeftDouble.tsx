import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ChevronLeftDouble = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M11.7 7.7C12.09 7.31 12.09 6.68 11.7 6.29C11.31 5.9 10.68 5.9 10.29 6.29L5.29 11.29C4.9 11.68 4.9 12.31 5.29 12.7L10.29 17.7C10.68 18.09 11.31 18.09 11.7 17.7C12.09 17.31 12.09 16.68 11.7 16.29L7.41 12L11.7 7.7ZM18.7 7.7C19.09 7.31 19.09 6.68 18.7 6.29C18.31 5.9 17.68 5.9 17.29 6.29L12.29 11.29C11.9 11.68 11.9 12.31 12.29 12.7L17.29 17.7C17.68 18.09 18.31 18.09 18.7 17.7C19.09 17.31 19.09 16.68 18.7 16.29L14.41 12L18.7 7.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
