import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const OpenWide = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M15 2L21 2C21.33 2 21.58 2.08 21.75 2.25C21.91 2.41 22 2.66 22 3L22 9C22 9.56 21.56 10 21 10C20.43 10 20 9.56 20 9L20 5.41L5.41 20L9 20C9.56 20 10 20.44 10 21C10 21.56 9.56 22 9 22L3 22C2.33 22 2 21.66 2 21L2 15C2 14.44 2.43 14 3 14C3.56 14 4 14.44 4 15L4 18.58L18.58 4L15 4C14.43 4 14 3.56 14 3C14 2.44 14.43 2 15 2Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
