import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const BBBArrowRight = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M16.26 6.68L20.55 10.98L11.99 10.99C11.43 10.99 10.99 11.43 10.99 11.99C10.99 12.55 11.43 12.99 11.99 12.99L20.55 12.98L16.26 17.27C15.86 17.67 15.86 18.29 16.26 18.68C16.65 19.08 17.28 19.08 17.67 18.68L23.67 12.68C23.87 12.49 23.96 12.25 23.96 11.98C23.96 11.7 23.87 11.46 23.67 11.27L17.67 5.27C17.28 4.87 16.65 4.87 16.26 5.27C15.86 5.67 15.86 6.29 16.26 6.68Z"
        fillRule="evenodd"
      />
      <path d="M0 12C0 9.79 1.79 8 4 8C6.2 8 8 9.79 8 12C8 14.2 6.2 16 4 16C1.79 16 0 14.2 0 12Z" fillRule="evenodd" />
    </SvgIcon>
  );
};
