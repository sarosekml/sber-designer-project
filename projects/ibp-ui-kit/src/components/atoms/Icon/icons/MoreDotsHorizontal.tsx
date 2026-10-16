import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const MoreDotsHorizontal = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M12 13C11.44 13 11 12.55 11 12C11 11.44 11.44 11 12 11C12.55 11 13 11.44 13 12C13 12.55 12.55 13 12 13ZM19 13C18.44 13 18 12.55 18 12C18 11.44 18.44 11 19 11C19.55 11 20 11.44 20 12C20 12.55 19.55 13 19 13ZM5 13C4.44 13 4 12.55 4 12C4 11.44 4.44 11 5 11C5.55 11 6 11.44 6 12C6 12.55 5.55 13 5 13Z" stroke="currentColor" strokeWidth="2.000000" strokeLinejoin="round"/>
    </SvgIcon>
  );
};
