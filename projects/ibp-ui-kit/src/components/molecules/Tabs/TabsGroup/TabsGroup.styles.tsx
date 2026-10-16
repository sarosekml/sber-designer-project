import { Orientation } from '@mui/material';

import { Sx } from '@/utils';

import { TabVariants } from './TabsGroup.types';

export const tabsGroupStyles =
  (variant: TabVariants, orientation: Orientation): Sx =>
  (theme) => ({
    borderBottom: orientation === 'horizontal' ? '1px solid' : 'none',
    borderColor: theme.palette.Border.BorderPrimary,
    minHeight: 'auto',
    '& .dmb-uikit-MuiTabs-indicator': {
      backgroundColor: theme.palette.Primary.Primary,
      right: 'auto',
      left: 0,
    },
    '& .dmb-uikit-MuiButtonBase-root': {
      display: 'flex',
      justifyContent: variant === 'fullWidth' ? 'center' : 'space-between',
    },
  });
