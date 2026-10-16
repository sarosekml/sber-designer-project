import { Theme } from '@mui/material';

import { MediumSizeType } from '@/types';

import { IconColors } from '../Icon/Icon.types';

export const getIconSize = (theme: Theme): Record<MediumSizeType, string> => ({
  lg: theme.spacing(6),
  md: theme.spacing(5),
  sm: theme.spacing(4),
});

export const getHoverSize = (theme: Theme): Record<MediumSizeType, string> => ({
  lg: theme.spacing(10),
  md: theme.spacing(8),
  sm: theme.spacing(6),
});

export const actualIconButtonColors: IconColors[] = ['error', 'warning', 'success', 'info'];
