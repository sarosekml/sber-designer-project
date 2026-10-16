import { Sx } from '@/utils';

export const breadCrumbsDropdownSx: Sx = (theme) => ({
  padding: 0,
  '&:hover': {
    background: 'none',
    '& .IconButton_icon__controller': {
      color: theme.palette.Text.TextSecondary,
    },
  },
  '& .IconButton_icon__controller': {
    color: theme.palette.Text.TextSecondary,
  },
});
