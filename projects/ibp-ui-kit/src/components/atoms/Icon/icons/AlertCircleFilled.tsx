import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const AlertCircleFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1ZM13 8C13 7.44 12.55 7 12 7C11.44 7 11 7.44 11 8L11 12C11 12.55 11.44 13 12 13C12.55 13 13 12.55 13 12L13 8ZM12 15C11.44 15 11 15.44 11 16C11 16.55 11.44 17 12 17L12.01 17C12.56 17 13.01 16.55 13.01 16C13.01 15.44 12.56 15 12.01 15L12 15Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
