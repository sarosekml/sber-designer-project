import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Maximize = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M15 2L21 2C21.27 2 21.51 2.09 21.7 2.29C21.9 2.48 22 2.72 22 3L22 9C22 9.56 21.56 10 21 10C20.43 10 20 9.56 20 9L20 5.41L14.7 10.7C14.31 11.1 13.68 11.1 13.29 10.7C12.89 10.31 12.89 9.68 13.29 9.29L18.58 4L15 4C14.43 4 14 3.56 14 3C14 2.44 14.43 2 15 2ZM10.7 14.7L5.41 20L9 20C9.56 20 10 20.44 10 21C10 21.56 9.56 22 9 22L3 22C2.72 22 2.48 21.9 2.29 21.7C2.09 21.51 2 21.27 2 21L2 15C2 14.44 2.43 14 3 14C3.56 14 4 14.44 4 15L4 18.58L9.29 13.29C9.68 12.89 10.31 12.89 10.7 13.29C11.1 13.68 11.1 14.31 10.7 14.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
