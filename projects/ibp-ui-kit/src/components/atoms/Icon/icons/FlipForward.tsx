import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const FlipForward = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M17.7 4.29C17.31 3.9 16.68 3.9 16.29 4.29C15.9 4.68 15.9 5.31 16.29 5.7L18.58 8L7.5 8C4.46 8 2 10.46 2 13.5C2 16.53 4.46 19 7.5 19L12 19C12.55 19 13 18.55 13 18C13 17.44 12.55 17 12 17L7.5 17C5.56 17 4 15.43 4 13.5C4 11.56 5.56 10 7.5 10L18.58 10L16.29 12.29C15.9 12.68 15.9 13.31 16.29 13.7C16.68 14.09 17.31 14.09 17.7 13.7L21.7 9.7C22.09 9.31 22.09 8.68 21.7 8.29L17.7 4.29Z" fillRule="nonzero"/>
    </SvgIcon>
  );
};
