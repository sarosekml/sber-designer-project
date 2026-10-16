import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Pulsar2 = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1Z" fillRule="evenodd"/>
      <path d="M12 8C9.79 8 8 9.79 8 12C8 14.2 9.79 16 12 16C14.2 16 16 14.2 16 12C16 9.79 14.2 8 12 8Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
