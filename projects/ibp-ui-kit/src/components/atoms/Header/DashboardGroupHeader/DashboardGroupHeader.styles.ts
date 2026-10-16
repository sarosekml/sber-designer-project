import { useMemo } from 'react';

import { mergeSx, Sx } from '@/utils';

const dashboardGroupHeaderStyles: Sx = (theme) => ({
  color: theme.palette.secondary.main,
});

const getTextStyles: Sx = (theme) => ({
  '.dmb-uikit-MuiTypography-root': {
    ...theme.typography.BodySReg,
    paddingRight: 2,
    flexGrow: 0,
    order: 0,
  },
});

const getLineStyles: Sx = (theme) => ({
  '.dmb-uikit-DashboardGroupHeader-Line': {
    flexGrow: 1,
    borderRight: `1px solid ${theme.palette.Border.BorderDark}`,
    borderTop: `1px solid ${theme.palette.Border.BorderDark}`,
    height: theme.spacing(1.75),
  },
});

export const useDashboardGroupHeaderStyles = (sx?: Sx) =>
  useMemo(() => mergeSx(dashboardGroupHeaderStyles, getTextStyles, getLineStyles, sx), [sx]);
