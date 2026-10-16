import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Download = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M13 3C13 2.44 12.56 2 12 2C11.43 2 11 2.44 11 3L11 14.58L6.7 10.29C6.31 9.89 5.68 9.89 5.29 10.29C4.89 10.68 4.89 11.31 5.29 11.7L11.29 17.7C11.48 17.9 11.72 18 12 18C12.27 18 12.51 17.9 12.7 17.7L18.7 11.7C19.1 11.31 19.1 10.68 18.7 10.29C18.31 9.89 17.68 9.89 17.29 10.29L13 14.58L13 3ZM3 20L21 20C21.56 20 22 20.44 22 21C22 21.56 21.56 22 21 22L3 22C2.43 22 2 21.56 2 21C2 20.44 2.43 20 3 20Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
