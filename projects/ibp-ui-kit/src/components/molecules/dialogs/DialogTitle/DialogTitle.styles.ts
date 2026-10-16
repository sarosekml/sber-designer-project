import { Sx } from '@/utils';

export const dialogTitleSx: Sx = (theme) => ({
  alignItems: 'center',
  borderBottom: `1px solid ${theme.palette.Border.BorderPrimary}`,
  display: 'flex',
  margin: 0,
  padding: theme.spacing(5, 6),
});
export const dialogTitleTextSx: Sx = (theme) => ({ flexGrow: 1, color: theme.palette.Text.TextPrimary });
