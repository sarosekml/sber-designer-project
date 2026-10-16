import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowDown = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M13 4C13 3.44 12.55 3 12 3C11.43 3 11 3.44 11 4L11 17.58L6.7 13.29C6.31 12.89 5.68 12.89 5.29 13.29C4.89 13.68 4.89 14.31 5.29 14.7L11.29 20.7C11.48 20.9 11.72 21 12 21C12.27 21 12.51 20.9 12.7 20.7L18.7 14.7C19.1 14.31 19.1 13.68 18.7 13.29C18.31 12.89 17.68 12.89 17.29 13.29L13 17.58L13 4Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
