import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ArrowLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12.7 5.7L7.41 11L19 11C19.56 11 20 11.43 20 12C20 12.55 19.56 13 19 13L7.41 13L12.7 18.29C13.1 18.68 13.1 19.31 12.7 19.7C12.31 20.1 11.68 20.1 11.29 19.7L4.29 12.7C4.09 12.51 4 12.27 4 12C4 11.72 4.09 11.48 4.29 11.29L11.29 4.29C11.68 3.89 12.31 3.89 12.7 4.29C13.1 4.68 13.1 5.31 12.7 5.7Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
