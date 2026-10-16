import { Sx } from '@/utils';

export const getStyles = (): Sx => (theme) => ({
  minHeight: theme.spacing(14),
  width: '100%',

  backgroundColor: theme.palette.BG.BGTableDefaultHover,
  borderRadius: theme.spacing(2),
});
