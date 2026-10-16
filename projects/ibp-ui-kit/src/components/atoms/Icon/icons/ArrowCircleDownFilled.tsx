import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowCircleDownFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1ZM12 7C12.55 7 13 7.44 13 8L13 13.58L15.29 11.29C15.68 10.9 16.31 10.9 16.7 11.29C17.09 11.68 17.09 12.31 16.7 12.7L12.7 16.7C12.31 17.09 11.68 17.09 11.29 16.7L7.29 12.7C6.9 12.31 6.9 11.68 7.29 11.29C7.68 10.9 8.31 10.9 8.7 11.29L11 13.58L11 8C11 7.44 11.44 7 12 7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
