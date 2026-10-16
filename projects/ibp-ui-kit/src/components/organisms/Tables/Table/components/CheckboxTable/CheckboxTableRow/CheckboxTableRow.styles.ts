import { cGrey, mGrey } from '@/styles/colors';
import { Sx } from '@/utils';

export const rowStyles: Sx = (theme) => ({
  borderCollapse: 'collapse',
  cursor: 'pointer',
  backgroundColor: theme.palette.BG.BGTableDefault,
});

export const cellStyles: Sx = (theme) => ({
  borderColor: theme.palette.Border.BorderLight,
  padding: theme.spacing(2, 2, 2, 0),
  height: theme.spacing(5),
  fontSize: '16px',
  cursor: 'pointer',
});

export const labelStyles: Sx = {
  label: { marginRight: 0, paddingRight: 0 },
};

export const checkboxCellStyles: Sx = (theme) => ({
  padding: theme.spacing(2, 0),
  width: theme.spacing(5),
  textAlign: 'left',
});

export const checkboxHeaderCellStyles: Sx = (theme) => ({
  backgroundColor: mGrey[0],
  padding: theme.spacing(2, 0),
  borderColor: theme.palette.Border.BorderPrimary,
});

export const tableTitleStyles: Sx = (theme) => ({
  color: cGrey[700],
  padding: theme.spacing(2, 2, 2, 0),
});
