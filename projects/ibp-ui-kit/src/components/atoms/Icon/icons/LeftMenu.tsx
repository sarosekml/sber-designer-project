import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const LeftMenu = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M3 5L21 5C21.56 5 22 5.43 22 6C22 6.56 21.56 7 21 7L3 7C2.43 7 2 6.56 2 6C2 5.43 2.43 5 3 5ZM3 11L21 11C21.56 11 22 11.43 22 12C22 12.56 21.56 13 21 13L3 13C2.43 13 2 12.56 2 12C2 11.43 2.43 11 3 11ZM3 17L21 17C21.56 17 22 17.43 22 18C22 18.56 21.56 19 21 19L3 19C2.43 19 2 18.56 2 18C2 17.43 2.43 17 3 17Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
