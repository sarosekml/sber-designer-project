import { Sx, Theme } from '@/utils';

export const getSelectAllOptionStyles: Sx = (theme: Theme) => ({
  padding: theme.spacing(2, 4),
  '&:hover': {
    backgroundColor: theme.palette.Tertiary.Tertiary,
    cursor: 'pointer',
  },
});
