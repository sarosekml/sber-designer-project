import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const CheckBoxBlank = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path d="M5 21C4.44 21 3.97 20.8 3.58 20.41C3.19 20.02 3 19.54 3 19L3 5C3 4.44 3.19 3.97 3.58 3.58C3.97 3.19 4.44 3 5 3L19 3C19.54 3 20.02 3.19 20.41 3.58C20.8 3.97 21 4.44 21 5L21 19C21 19.54 20.8 20.02 20.41 20.41C20.02 20.8 19.54 21 19 21L5 21ZM5 19L19 19L19 5L5 5L5 19Z" fillRule="nonzero"/>
    </SvgIcon>
  );
};
