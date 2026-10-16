import React from 'react';
import { Avatar as AvatarMui } from '@mui/material';

import { useAvatarProps } from './Avatar.styles';
import { AvatarProps } from './Avatar.types';

export const Avatar = (props: AvatarProps) => {
  const avatarProps = useAvatarProps(props);

  return <AvatarMui {...avatarProps} />;
};
