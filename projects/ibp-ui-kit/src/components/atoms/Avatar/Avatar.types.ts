import { AvatarProps as AvatarPropsMui } from '@mui/material';

import { MediumSizeType } from '@/types';

export interface AvatarProps extends AvatarPropsMui {
  name?: string;
  size?: MediumSizeType | 'xl';
}
