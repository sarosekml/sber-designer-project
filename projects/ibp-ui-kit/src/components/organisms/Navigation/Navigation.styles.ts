import { Sx } from '@/utils/mergeSx';

export const drawerWidth = 320;
export const drawerWidthMinimized = 56;

export const getDrawerRootStyles =
  ({ opened }: { opened: boolean }): Sx =>
  (theme) => ({
    minWidth: drawerWidthMinimized,
    '& .dmb-uikit-MuiPaper-root': {
      overflow: 'hidden',
      border: 'none',
      ...(opened
        ? {
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.enteringScreen,
              easing: theme.transitions.easing.sharp,
            }),
            width: drawerWidth,
            boxShadow:
              '0px 11px 15px rgba(0, 0, 0, 0.2), 0px 24px 38px rgba(0, 0, 0, 0.14), 0px 9px 46px rgba(0, 0, 0, 0.12)',
          }
        : {
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.leavingScreen,
              easing: theme.transitions.easing.sharp,
            }),
            width: drawerWidthMinimized,
          }),
    },
  });

export const itemWrapperStyles = {
  display: 'flex',
  flexDirection: 'column',
};

export const wrapperStyles: Sx = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  overflow: 'hidden',

  '&:hover': {
    overflowY: 'overlay',
  },
};

export const toolbarStyles: Sx = (theme) => ({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'start',
  padding: theme.spacing(4),
});

export const compartmentStyles: Sx = (theme) => ({
  p: theme.spacing(3, 0, 0, 4),
  color: theme.palette.Text.TextInactive,
  maxHeight: '29px',
  minHeight: '29px',
});

export const dividerStyles: Sx = (theme) => ({
  borderBottom: `1px solid ${theme.palette.Border.BorderLight}`,
  mx: theme.spacing(3),
  my: theme.spacing(3.5),
});

export const burgerButtonStyles: Sx = (theme) => ({
  '&:hover': {
    backgroundColor: theme.palette.Primary.PrimaryBGLight,
  },
});
