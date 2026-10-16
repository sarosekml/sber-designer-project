import { AlertStylesProps } from '@/components/molecules/Alert/Alert.types';
import { Sx } from '@/utils';

export const getCollapseStyles =
  ({ isExpanded }: Omit<AlertStylesProps, 'hasTitle'>): Sx =>
  (theme) => ({
    ...theme.typography.BodyXSExtensive,
    color: theme.palette.Text.TextSecondary,
    padding: () => {
      if (!isExpanded) return 0;
      return theme.spacing(1.5, 0, 3, 0);
    },
  });

export const getAlertTitleStyles =
  ({ hasTitle }: Pick<AlertStylesProps, 'hasTitle'>): Sx =>
  (theme) => ({
    ...theme.typography.BodyLReg,
    color: theme.palette.Text.TextPrimary,
    padding: hasTitle ? theme.spacing(1, 0, 0) : 0,
  });

export const actionsContainerStyles: Sx = (theme) => ({
  display: 'flex',
  flexWrap: 'nowrap',
  padding: theme.spacing(1, 0),
  justifyContent: 'flex-end',
  columnGap: theme.spacing(3),
});

export const alertRootStyles: Sx = (theme) => ({
  borderRadius: 0,
  minHeight: theme.spacing(12),
  width: '100%',
  padding: theme.spacing(2, 6),

  '& div.dmb-uikit-MuiAlert-icon': {
    padding: theme.spacing(1, 2, 1, 0),
    margin: 0,

    svg: {
      width: theme.spacing(6),
      height: theme.spacing(6),
    },
  },

  '& div.dmb-uikit-MuiAlert-message': {
    width: '100%',
    padding: 0,
    '& .dmb-uikit-MuiTypography-root': {
      margin: 0,
    },
  },

  '& div.dmb-uikit-MuiAlert-action': {
    padding: theme.spacing(0, 0, 0, 6),
    margin: 0,
  },
});
