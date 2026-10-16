import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowDown = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M13 5C13 4.43 12.55 4 12 4C11.43 4 11 4.43 11 5L11 16.58L5.7 11.29C5.31 10.89 4.68 10.89 4.29 11.29C3.89 11.68 3.89 12.31 4.29 12.7L11.29 19.7C11.48 19.9 11.72 20 12 20C12.27 20 12.51 19.9 12.7 19.7L19.7 12.7C20.1 12.31 20.1 11.68 19.7 11.29C19.31 10.89 18.68 10.89 18.29 11.29L13 16.58L13 5Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
