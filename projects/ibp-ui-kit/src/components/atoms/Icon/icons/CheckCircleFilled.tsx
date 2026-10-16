import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const CheckCircleFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1ZM17.2 9.7C17.59 9.31 17.59 8.68 17.2 8.29C16.81 7.9 16.18 7.9 15.79 8.29L10.5 13.58L8.2 11.29C7.81 10.9 7.18 10.9 6.79 11.29C6.4 11.68 6.4 12.31 6.79 12.7L9.79 15.7C10.18 16.09 10.81 16.09 11.2 15.7L17.2 9.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
