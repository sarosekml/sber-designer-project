import React from 'react';

import { SxBox } from '@/components/atoms';
import { Icon, IconProps } from '@/components/atoms/Icon';

import { iconWrapperStyles } from './CentredIcon.styles';

/** @deprecated Potencially deprecated and need to use usual icon */
export const CentredIcon = React.memo((props: IconProps) => {
  return (
    <SxBox sx={iconWrapperStyles}>
      <Icon {...props} />
    </SxBox>
  );
});
