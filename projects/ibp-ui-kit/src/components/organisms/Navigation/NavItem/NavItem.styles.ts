import { Sx } from '@/utils';

export const listItemIconStyles: Sx = (theme) => ({
  minWidth: theme.spacing(6),
  alignSelf: 'flex-start',
  position: 'relative',
});

export const iconStyles: Sx = (theme) => ({
  color: theme.palette.Secondary.Secondary,
});

export const getListItemTextStyles =
  (disabled?: boolean): Sx =>
  (theme) => ({
    color: theme.palette.Text.TextSecondary,
    opacity: disabled ? 0.38 : 1,
    margin: 0,
    pl: 4,
    whiteSpace: 'nowrap',
    width: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

export const getListItemStyles: Sx = (theme) => ({
  borderRadius: 0,
  minWidth: theme.spacing(6),
  minHeight: theme.spacing(6),
  p: 4,
  color: theme.palette.Text.TextSecondary,
  '&:hover': {
    backgroundColor: theme.palette.Primary.PrimaryBGLight,
  },
  '&.active-item': {
    '.dmb-uikit-MuiIcon-root': {
      color: theme.palette.Secondary.SecondaryDark,
    },
  },
});

export const iconCoveredElementWrapperStyles: Sx = (theme) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'absolute',
  top: 0,
  left: theme.spacing(2),
  ...theme.typography.BodySStrongSmb,
});

export const postfixElementStyles: Sx = (theme) => ({
  ...theme.typography.BodyMReg,
});
