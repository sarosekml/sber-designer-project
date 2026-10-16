import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const InfoCircleFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1ZM12 7C11.44 7 11 7.44 11 8C11 8.55 11.44 9 12 9L12.01 9C12.56 9 13.01 8.55 13.01 8C13.01 7.44 12.56 7 12.01 7L12 7ZM13 12C13 11.44 12.55 11 12 11C11.44 11 11 11.44 11 12L11 16C11 16.55 11.44 17 12 17C12.55 17 13 16.55 13 16L13 12Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
