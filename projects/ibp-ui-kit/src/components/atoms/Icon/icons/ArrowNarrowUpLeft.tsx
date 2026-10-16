import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowUpLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M4.99 6L4.99 14C4.99 14.56 5.43 15 5.99 15C6.55 15 6.99 14.56 6.99 14L6.99 8.41L17.29 18.7C17.68 19.1 18.31 19.1 18.7 18.7C19.1 18.31 19.1 17.68 18.7 17.29L8.41 7L13.99 7C14.55 7 14.99 6.56 14.99 6C14.99 5.44 14.55 5 13.99 5L5.99 5C5.72 5 5.48 5.09 5.29 5.29C5.09 5.48 4.99 5.72 4.99 6Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
