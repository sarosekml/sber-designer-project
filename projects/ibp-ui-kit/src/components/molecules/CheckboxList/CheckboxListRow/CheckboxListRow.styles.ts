import { Sx } from '@/utils';

export const checkboxListRowSx: Sx = (theme) => ({
  borderCollapse: 'collapse',
  cursor: 'pointer',

  padding: theme.spacing(2, 0),
});

export const headerCheckboxListRowSx = () => (theme) => ({
  padding: theme.spacing(4, 0),
  borderBottom: `1px solid ${theme.palette.Border.BorderPrimary}`,
});
