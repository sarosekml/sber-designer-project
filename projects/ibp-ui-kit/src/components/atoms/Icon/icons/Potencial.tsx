import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const Potencial = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props} width="24" height="24">
      <path
        d="M8 4C7.07 4 6.6 4 6.22 4.1C5.18 4.37 4.37 5.18 4.1 6.22C4 6.6 4 7.06 4 8L4 17.2C4 18.88 4 19.72 4.32 20.36C4.61 20.92 5.07 21.38 5.63 21.67C6.27 22 7.11 22 8.8 22L15.2 22C16.88 22 17.72 22 18.36 21.67C18.92 21.38 19.38 20.92 19.67 20.36C20 19.72 20 18.88 20 17.2L20 8C20 7.06 20 6.6 19.89 6.22C19.62 5.18 18.81 4.37 17.77 4.1C17.39 4 16.92 4 16 4M9.6 2C9.04 2 8.76 2 8.54 2.1C8.35 2.2 8.2 2.35 8.1 2.54C8 2.75 8 3.04 8 3.6L8 4.39C8 4.95 8 5.24 8.1 5.45C8.2 5.64 8.35 5.79 8.54 5.89C8.76 6 9.04 6 9.6 6L14.39 6C14.96 6 15.24 6 15.45 5.89C15.64 5.79 15.79 5.64 15.89 5.45C16 5.24 16 4.95 16 4.39L16 3.6C16 3.04 16 2.75 15.89 2.54C15.79 2.35 15.64 2.2 15.45 2.1C15.24 2 14.96 2 14.39 2L9.6 2ZM16 17L8 17M9 14L15 14M8 14L16 14M9 11L15 11M8 11L16 11"
        stroke="currentColor"
        strokeOpacity="1"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="transparent"
        fillOpacity="0"
      />
    </SvgIcon>
  );
};
