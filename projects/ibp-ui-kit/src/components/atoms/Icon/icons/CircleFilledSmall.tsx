import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const CircleFilledSmall = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 3C7.02 3 3 7.02 3 12C3 16.97 7.02 21 12 21C16.97 21 21 16.97 21 12C21 7.02 16.97 3 12 3Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
