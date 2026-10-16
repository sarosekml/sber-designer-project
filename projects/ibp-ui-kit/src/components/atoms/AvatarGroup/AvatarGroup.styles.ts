import { MediumSizeType } from '@/types';
import { Sx } from '@/utils';

import { useAvatarStyles } from '../Avatar';

export const useGetSpacing = (size?: MediumSizeType | 'xl') => {
  switch (size) {
    case 'sm':
      return 4;
    case 'md':
      return 6;
    case 'lg':
      return 8;
    case 'xl':
      return 24;
    default:
      return 8;
  }
};

export const useAvatarGroupStyles = ({ size }: { size?: MediumSizeType | 'xl' }): Sx => {
  const getAvatarSx = useAvatarStyles({ size });
  return (theme) => ({
    '& .dmb-uikit-MuiAvatar-root': {
      ...getAvatarSx(theme),
    },
  });
};
