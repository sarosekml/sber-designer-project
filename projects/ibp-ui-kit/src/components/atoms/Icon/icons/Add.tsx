import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Add = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M13 5C13 4.43 12.56 4 12 4C11.44 4 11 4.43 11 5L11 11L5 11C4.44 11 4 11.43 4 12C4 12.56 4.44 13 5 13L11 13L11 19C11 19.56 11.44 20 12 20C12.56 20 13 19.56 13 19L13 13L19 13C19.56 13 20 12.56 20 12C20 11.43 19.56 11 19 11L13 11L13 5Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
