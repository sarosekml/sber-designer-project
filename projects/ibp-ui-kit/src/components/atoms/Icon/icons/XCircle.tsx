import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const XCircle = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1ZM15.7 8.29C16.09 8.68 16.09 9.31 15.7 9.7L13.41 12L15.7 14.29C16.09 14.68 16.09 15.31 15.7 15.7C15.31 16.09 14.68 16.09 14.29 15.7L12 13.41L9.7 15.7C9.31 16.09 8.68 16.09 8.29 15.7C7.9 15.31 7.9 14.68 8.29 14.29L10.58 12L8.29 9.7C7.9 9.31 7.9 8.68 8.29 8.29C8.68 7.9 9.31 7.9 9.7 8.29L12 10.58L14.29 8.29C14.68 7.9 15.31 7.9 15.7 8.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
