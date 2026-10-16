import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowDownLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M18.7 6.7L8.41 16.99L13.99 16.99C14.55 16.99 14.99 17.43 14.99 17.99C14.99 18.55 14.55 18.99 13.99 18.99L5.99 18.99C5.72 18.99 5.48 18.9 5.29 18.7C5.09 18.51 4.99 18.27 4.99 17.99L4.99 9.99C4.99 9.43 5.43 8.99 5.99 8.99C6.55 8.99 6.99 9.43 6.99 9.99L6.99 15.58L17.29 5.29C17.68 4.89 18.31 4.89 18.7 5.29C19.1 5.68 19.1 6.31 18.7 6.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
