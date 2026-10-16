import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const MarkerPin01 = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24" width="24" height="24">
      <path
        d="M12 13C10.34 13 9 11.65 9 10C9 8.34 10.34 7 12 7C13.65 7 15 8.34 15 10C15 11.65 13.65 13 12 13ZM12 22C8 18 4 14.41 4 10C4 5.58 7.58 2 12 2C16.41 2 20 5.58 20 10C20 14.41 16 18 12 22Z"
        stroke="currentColor"
        strokeOpacity="1.000000"
        strokeWidth="2.000000"
        strokeLinejoin="round"
        fill="none"
      />
    </SvgIcon>
  );
};
