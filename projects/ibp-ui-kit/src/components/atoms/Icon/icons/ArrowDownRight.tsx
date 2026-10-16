import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowDownRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M7.7 6.29C7.31 5.89 6.68 5.89 6.29 6.29C5.89 6.68 5.89 7.31 6.29 7.7L14.58 16L7 16C6.44 16 6 16.43 6 17C6 17.55 6.44 18 7 18L17 18C17.27 18 17.51 17.9 17.7 17.7C17.9 17.51 18 17.27 18 17L18 7C18 6.43 17.56 6 17 6C16.44 6 16 6.43 16 7L16 14.58L7.7 6.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
