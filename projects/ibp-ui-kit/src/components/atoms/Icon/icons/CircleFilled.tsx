import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const CircleFilled = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 1C5.92 1 1 5.92 1 12C1 18.07 5.92 23 12 23C18.07 23 23 18.07 23 12C23 5.92 18.07 1 12 1Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
