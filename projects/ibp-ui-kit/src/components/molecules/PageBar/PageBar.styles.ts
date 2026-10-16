import { SxProps } from '@mui/material';

import { Sx } from '@/utils';

import { StylesProps } from './PageBar.types';

export const appBarStyles: Sx = {
  boxShadow: 'none',
};

export const getToolbarStyles =
  ({ isStickButtonLeft }: StylesProps): SxProps =>
  () => {
    return {
      alignItems: 'center',
      display: 'flex',
      ...(!isStickButtonLeft && { justifyContent: 'space-between' }),

      '&.dmb-uikit-MuiToolbar-root': {
        padding: 0,
        minHeight: 0,
      },
    };
  };

export const tileContainerStyles: Sx = (theme) => ({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginRight: theme.spacing(6),
});

export const extraBarStyles: Sx = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

export const subBarStyles: Sx = (theme) => ({
  alignItems: 'center',
  display: 'flex',
  height: 'fit-content',
  justifyContent: 'space-between',
  margin: theme.spacing(3, 0, 4),
});
