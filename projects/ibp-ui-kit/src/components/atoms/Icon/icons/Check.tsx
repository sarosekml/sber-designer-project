import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Check = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M20.7 6.7L9.7 17.7C9.51 17.9 9.27 18 9 18C8.72 18 8.48 17.9 8.29 17.7L3.29 12.7C2.89 12.31 2.89 11.68 3.29 11.29C3.68 10.89 4.31 10.89 4.7 11.29L9 15.58L19.29 5.29C19.68 4.89 20.31 4.89 20.7 5.29C21.1 5.68 21.1 6.31 20.7 6.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
