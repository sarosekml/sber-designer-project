import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Close = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M6.7 5.29C6.31 4.89 5.68 4.89 5.29 5.29C4.89 5.68 4.89 6.31 5.29 6.7L10.58 12L5.29 17.29C4.89 17.68 4.89 18.31 5.29 18.7C5.68 19.1 6.31 19.1 6.7 18.7L12 13.41L17.29 18.7C17.68 19.1 18.31 19.1 18.7 18.7C19.1 18.31 19.1 17.68 18.7 17.29L13.41 12L18.7 6.7C19.1 6.31 19.1 5.68 18.7 5.29C18.31 4.89 17.68 4.89 17.29 5.29L12 10.58L6.7 5.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
