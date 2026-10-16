import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const CheckBox = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M4.25 20.86C4.48 20.95 4.73 21 5 21L19 21C19.54 21 20.02 20.8 20.41 20.41C20.8 20.02 21 19.54 21 19L21 5C21 4.73 20.95 4.48 20.86 4.25C20.76 4 20.61 3.78 20.41 3.58C20.02 3.19 19.54 3 19 3L5 3C4.73 3 4.48 3.04 4.25 3.13C4 3.23 3.78 3.38 3.58 3.58C3.38 3.78 3.23 4 3.13 4.25C3.04 4.48 3 4.73 3 5L3 19C3 19.54 3.19 20.02 3.58 20.41C3.78 20.61 4 20.76 4.25 20.86ZM17.64 9.15L10.6 16.2L6.35 11.95L7.75 10.54L10.6 13.4L16.25 7.75L17.64 9.15Z" fillRule="evenodd"/>
    </SvgIcon>
  );
};
