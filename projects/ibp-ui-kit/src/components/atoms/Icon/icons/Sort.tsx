import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Sort = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 6.41L15.29 9.7C15.68 10.1 16.31 10.1 16.7 9.7C17.1 9.31 17.1 8.68 16.7 8.29L12.7 4.29C12.51 4.09 12.27 4 12 4C11.72 4 11.48 4.09 11.29 4.29L7.29 8.29C6.89 8.68 6.89 9.31 7.29 9.7C7.68 10.1 8.31 10.1 8.7 9.7L12 6.41ZM8.7 14.29C8.31 13.89 7.68 13.89 7.29 14.29C6.89 14.68 6.89 15.31 7.29 15.7L11.29 19.7C11.48 19.9 11.72 20 12 20C12.27 20 12.51 19.9 12.7 19.7L16.7 15.7C17.1 15.31 17.1 14.68 16.7 14.29C16.31 13.89 15.68 13.89 15.29 14.29L12 17.58L8.7 14.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
