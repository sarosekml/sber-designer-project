import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12.7 4.29C12.31 3.89 11.68 3.89 11.29 4.29C10.89 4.68 10.89 5.31 11.29 5.7L16.58 11L5 11C4.43 11 4 11.43 4 12C4 12.55 4.43 13 5 13L16.58 13L11.29 18.29C10.89 18.68 10.89 19.31 11.29 19.7C11.68 20.1 12.31 20.1 12.7 19.7L19.7 12.7C19.9 12.51 20 12.27 20 12C20 11.72 19.9 11.48 19.7 11.29L12.7 4.29Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
