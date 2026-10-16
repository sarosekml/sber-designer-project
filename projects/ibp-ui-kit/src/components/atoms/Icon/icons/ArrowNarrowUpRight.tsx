import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowUpRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M10 5L18 5C18.27 5 18.51 5.09 18.7 5.29C18.9 5.48 19 5.72 19 6L19 14C19 14.56 18.56 15 18 15C17.44 15 17 14.56 17 14L17 8.41L6.7 18.7C6.31 19.1 5.68 19.1 5.29 18.7C4.89 18.31 4.89 17.68 5.29 17.29L15.58 7L10 7C9.44 7 9 6.56 9 6C9 5.44 9.44 5 10 5Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
