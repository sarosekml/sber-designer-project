import { Sx } from '@/utils';

export const defaultToastSx: Sx = (theme) => ({
  padding: 0,
  margin: 0,
  '& .toast-body': {
    backgroundColor: theme.palette.Product.PGrey,
    minHeight: theme.spacing(12),
    borderRadius: theme.spacing(1),
    padding: theme.spacing(4),
    margin: theme.spacing(6),
    color: theme.palette.Text.TextOnDark,
  },
  '& .dmb-uikit-MuiCircularProgress-svg': {
    color: theme.palette.Text.TextOnDark,
  },
});
