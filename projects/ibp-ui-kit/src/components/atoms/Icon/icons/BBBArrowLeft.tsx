import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const BBBArrowLeft = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M18.66 6.71L14.39 11L23 10.98C23.56 10.98 24 11.42 24 11.98C24 12.54 23.56 12.98 23 12.98L14.39 12.99L18.66 17.28C19.06 17.68 19.06 18.3 18.66 18.7C18.27 19.09 17.65 19.09 17.25 18.7L11.29 12.7C11.09 12.51 11 12.27 11 12C11 11.72 11.09 11.48 11.29 11.29L17.25 5.29C17.65 4.9 18.27 4.9 18.66 5.29C19.06 5.69 19.06 6.31 18.66 6.71Z"
        fillRule="evenodd"
      />
      <path d="M0 12C0 9.79 1.79 8 4 8C6.2 8 8 9.79 8 12C8 14.2 6.2 16 4 16C1.79 16 0 14.2 0 12Z" fillRule="evenodd" />
    </SvgIcon>
  );
};
