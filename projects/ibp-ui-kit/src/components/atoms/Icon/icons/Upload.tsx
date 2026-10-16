import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Upload = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M3 2L21 2C21.56 2 22 2.44 22 3C22 3.56 21.56 4 21 4L3 4C2.43 4 2 3.56 2 3C2 2.44 2.43 2 3 2ZM13 9.41L17.29 13.7C17.68 14.1 18.31 14.1 18.7 13.7C19.1 13.31 19.1 12.68 18.7 12.29L12.7 6.29C12.51 6.09 12.27 6 12 6C11.72 6 11.48 6.09 11.29 6.29L5.29 12.29C4.89 12.68 4.89 13.31 5.29 13.7C5.68 14.1 6.31 14.1 6.7 13.7L11 9.41L11 21C11 21.56 11.43 22 12 22C12.56 22 13 21.56 13 21L13 9.41Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
