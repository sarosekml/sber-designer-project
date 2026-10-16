import React from 'react';
import { AvatarGroup as AvatarGroupMui, AvatarGroupProps as AvatarGroupPropsMui } from '@mui/material';

import { MediumSizeType } from '@/types';
import { mergeSx } from '@/utils';

import { useAvatarGroupStyles, useGetSpacing } from './AvatarGroup.styles';

export interface AvatarGroupProps extends AvatarGroupPropsMui {
  size?: MediumSizeType | 'xl';
}

export const AvatarGroup = ({ children, size = 'lg', sx, ...rest }: AvatarGroupProps) => {
  const avatarGroupSx = useAvatarGroupStyles({ size });
  const spacing = useGetSpacing(size);

  return (
    <AvatarGroupMui spacing={spacing} sx={mergeSx(avatarGroupSx, sx)} {...rest}>
      {children}
    </AvatarGroupMui>
  );
};
