import { Sx } from '@/utils';

export const ProductButtonStyles: Sx = (theme) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3, 4),
  backgroundColor: theme.palette.BG.BGTile,
  border: `1px solid ${theme.palette.primary.light}`,
  color: theme.palette.primary.light,

  '&:hover': {
    backgroundColor: theme.palette.BG.BGSecondaryLight,
    border: `1px solid ${theme.palette.primary}`,
    color: theme.palette.primary,
  },
  '&:active': {
    backgroundColor: 'transparent',
    border: `1px solid ${theme.palette.secondary}`,
    color: theme.palette.secondary,
  },
  '&:disabled, &:disabled:hover': {
    backgroundColor: theme.palette.BG.BGTile,
    borderColor: theme.palette.Disabled.Disabled,
    color: theme.palette.Disabled.Disabled,
  },
  '& svg': {
    padding: theme.spacing(0, 4, 0, 2),
    fontSize: '24px',
    color: theme.palette.primary.light,
  },
  '& span': {
    overflow: 'unset',
    fontSize: '18px',
    lineHeight: '24px',
  },
});
