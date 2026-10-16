import { Sx } from '@/utils';

export const tableContainerStyles: Sx = {
  mt: 2,
  mb: 1,
};

export const muiTableStyles: Sx = {
  marginTop: 0,
  '& > tbody ': {
    overflowY: 'auto',
  },
  '& > tbody > tr > *': {
    border: 'none',
  },
};
