import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ChevronUp = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 10.41L17.29 15.7C17.68 16.1 18.31 16.1 18.7 15.7C19.1 15.31 19.1 14.68 18.7 14.29L12.7 8.29C12.51 8.09 12.27 8 12 8C11.72 8 11.48 8.09 11.29 8.29L5.29 14.29C4.89 14.68 4.89 15.31 5.29 15.7C5.68 16.1 6.31 16.1 6.7 15.7L12 10.41Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
