import { Sx } from '@/utils';

export const getUserProfileStyles = (isOpen: boolean): Record<string, Sx> => ({
  languageComponentSx: (theme) => ({
    marginRight: theme.spacing(1),
  }),
  userContainer: (theme) => ({
    display: 'flex',
    color: theme.palette.Text.TextPrimary,
    paddingBottom: theme.spacing(4),
    width: theme.spacing(80),
    '&:hover': {
      cursor: 'pointer',
      backgroundColor: theme.palette.Tertiary.TertiaryLight,
    },
  }),
  avatar: (theme) => ({
    fontSize: 10,
    background: theme.palette.Secondary.SecondaryDark,
    marginRight: theme.spacing(4),
    width: 24,
    height: 24,
  }),
  userName: (theme) => ({
    marginRight: theme.spacing(2.5),
    textTransform: 'none',
    color: theme.palette.Text.TextPrimary,
    marginBottom: theme.spacing(1.2),
    ...theme.typography.BodySStrongSmb,
  }),
  userPosition: (theme) => ({
    marginRight: theme.spacing(2.5),
    textTransform: 'none',
    color: theme.palette.Text.TextSecondary,
    ...theme.typography.BodyXSReg,
  }),
  logout: (theme) => ({
    display: 'flex',
    cursor: 'pointer',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    paddingRight: theme.spacing(3),
    paddingTop: theme.spacing(4),
  }),
  userInfoWrapper: (theme) => ({
    paddingTop: theme.spacing(4),
    paddingLeft: theme.spacing(4),
    flexWrap: 'nowrap',
    alignItems: isOpen ? 'flex-start' : 'center',
    ...(!isOpen && { width: theme.spacing(78) }),
  }),
  userInfo: {
    width: 'inherit',
    ...(!isOpen && { display: 'none' }),
  },
  deskInfo: (theme) => ({
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(4),
    color: theme.palette.Text.TextSecondary,
    ...theme.typography.BodySReg,
    '& .dmb-uikit-MuiTypography-root': {
      color: theme.palette.Text.TextSecondary,
    },
  }),
});
