import { type Theme } from '@mui/material';
import { SystemStyleObject } from '@mui/system/styleFunctionSx/styleFunctionSx';

import { MediumSizeType } from '@/types';
import { mergeSx } from '@/utils';

import { AvatarProps } from './Avatar.types';
import { generateAvatarColor, generateInitialsColor } from './Avatar.utils';

const getSize = (size?: MediumSizeType | 'xl') => {
  switch (size) {
    case 'sm':
      return { width: '24px', height: '24px', fontSize: '12px' };
    case 'md':
      return { width: '32px', height: '32px', fontSize: '14px' };
    case 'lg':
      return { width: '40px', height: '40px', fontSize: '14px' };
    case 'xl':
      return { width: '96px', height: '96px', fontSize: '24px' };
    default:
      return {};
  }
};

export const useAvatarStyles =
  ({ size, name }: AvatarProps): ((theme: Theme) => SystemStyleObject<Theme>) =>
  (theme) => ({
    ...getSize(size),
    color: name ? generateInitialsColor(name) : theme.palette.Text.TextOnTertiary,
    backgroundColor: name ? generateAvatarColor(name) : theme.palette.Tertiary.Tertiary,
  });

export const useAvatarProps = ({ name, size, sx, ...rest }: AvatarProps) => {
  const avatarSx = useAvatarStyles({ size, name });

  if (!name)
    return {
      sx: mergeSx(avatarSx, sx),
      ...rest,
    };

  const [firstName, lastName] = name.split(' ');

  return {
    children: `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`,
    sx: mergeSx(avatarSx, sx),
    ...rest,
  };
};
