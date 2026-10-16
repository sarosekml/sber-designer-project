export const COMPONENT_TEMPLATE = (componentName: string, content: string): string => `
import React from 'react';
import { SvgIcon } from '@mui/material';

import { SvgIconProps } from './icons.types';

export const ${componentName} = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      ${content}
    </SvgIcon>
  );
};`
