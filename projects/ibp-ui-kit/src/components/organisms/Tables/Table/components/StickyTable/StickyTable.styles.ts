import { Sx } from '@/utils';

export const stickyTableStyles: Sx = {
  tableLayout: 'fixed',
  borderCollapse: 'separate',
  '& .dmb-uikit-MuiTableHead-root th.dmb-uikit-MuiTableCell-head': {
    position: 'sticky',
    fallbacks: {
      position: '-webkit-sticky',
    },
  },
};
