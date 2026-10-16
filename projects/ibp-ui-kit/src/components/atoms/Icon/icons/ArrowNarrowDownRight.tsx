import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowNarrowDownRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M6.7 5.29C6.31 4.89 5.68 4.89 5.29 5.29C4.89 5.68 4.89 6.31 5.29 6.7L15.58 16.99L10 16.99C9.44 16.99 9 17.43 9 17.99C9 18.55 9.44 18.99 10 18.99L18 18.99C18.27 18.99 18.51 18.9 18.7 18.7C18.9 18.51 19 18.27 19 17.99L19 9.99C19 9.43 18.56 8.99 18 8.99C17.44 8.99 17 9.43 17 9.99L17 15.58L6.7 5.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
