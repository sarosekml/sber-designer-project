import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Modify = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 8C12 10.2 10.2 12 8 12C5.79 12 4 10.2 4 8C4 5.8 5.79 4 8 4C10.2 4 12 5.8 12 8Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
