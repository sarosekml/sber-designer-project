import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowCircleUpFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23ZM12 17C11.44 17 11 16.55 11 16L11 10.41L8.7 12.7C8.31 13.09 7.68 13.09 7.29 12.7C6.9 12.31 6.9 11.68 7.29 11.29L11.29 7.29C11.68 6.9 12.31 6.9 12.7 7.29L16.7 11.29C17.09 11.68 17.09 12.31 16.7 12.7C16.31 13.09 15.68 13.09 15.29 12.7L13 10.41L13 16C13 16.55 12.55 17 12 17Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
