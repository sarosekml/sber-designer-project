import { Sx } from '@/utils';

import { ContextMenuStyleProps } from './ContextMenu.type';

export const useStyles: (props: ContextMenuStyleProps) => Sx =
  ({ size, minWidth }) =>
  (theme) => ({
    '& .dmb-uikit-MuiPaper-root': {
      boxShadow: '0px 1px 2px rgba(51, 63, 72, 0.3), 0px 2px 6px 2px rgba(51, 63, 72, 0.15)',
      background: theme.palette.Tertiary.TertiaryLight,
      minWidth: minWidth ? theme.spacing(minWidth) : theme.spacing(30),
    },
    '& .ContextMenu__item': {
      height: size === 'lg' ? theme.spacing(12) : theme.spacing(8),
      padding: theme.spacing(1.5, 3),
      cursor: 'pointer',
      color: theme.palette.Text.TextPrimary,
      ...theme.typography.BodyMReg,
      '&:hover': {
        backgroundColor: theme.palette.Tertiary.Tertiary,
      },
    },
  });
