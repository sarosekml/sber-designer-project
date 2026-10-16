import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowUp = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M11.29 3.29L5.29 9.29C4.89 9.68 4.89 10.31 5.29 10.7C5.68 11.1 6.31 11.1 6.7 10.7L11 6.41L11 20C11 20.56 11.43 21 12 21C12.55 21 13 20.56 13 20L13 6.41L17.29 10.7C17.68 11.1 18.31 11.1 18.7 10.7C19.1 10.31 19.1 9.68 18.7 9.29L12.7 3.29C12.51 3.09 12.27 3 12 3C11.72 3 11.48 3.09 11.29 3.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
