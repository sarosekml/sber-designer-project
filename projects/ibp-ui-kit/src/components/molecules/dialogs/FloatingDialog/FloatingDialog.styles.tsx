import { useMemo } from 'react';

import { mergeSx,Sx } from '@/utils';

const floatingDialogSx: Sx = (theme) => ({
  overflow: 'hidden',
  backgroundColor: theme.palette.BG.BGPopup,
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '16px',
  boxShadow:
    '0px 9px 46px 0px rgba(0, 0, 0, 0.12), 0px 24px 38px 0px rgba(0, 0, 0, 0.14), 0px 11px 15px 0px rgba(0, 0, 0, 0.2)',

  '& .DialogTitle_root': {
    borderBottom: `1px solid ${theme.palette.Border.BorderLight}`,
  },
  '& .DialogActions_root': {
    borderTop: `1px solid ${theme.palette.Border.BorderLight}`,
  },
});

export const useFloatingDialogStyles = (customSx?: Sx): Sx =>
  useMemo(() => {
    return mergeSx(floatingDialogSx, customSx);
  }, [customSx]);
