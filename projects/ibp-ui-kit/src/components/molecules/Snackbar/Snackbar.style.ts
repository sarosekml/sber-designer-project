import { Sx } from '@/utils';

import { iconColors, snackbarColors } from './Snackbar.const';
import { SnackbarStyleProps,SnackbarTitleStyleProps } from './Snackbar.types';

export const getSnackbarTitleStyles: (props: SnackbarTitleStyleProps) => Sx =
  ({ severity }) =>
  (theme) => {
    const font = theme.typography.BodySReg;
    const {
      Text: { TextPrimary },
    } = theme.palette;

    return {
      mb: 1,
      color: TextPrimary,
      background: snackbarColors[severity],
      ...font,
    };
  };

export const getSnackbarAlertStyles: (props: SnackbarStyleProps) => Sx =
  ({ severity }) =>
  (theme) => {
    const font = theme.typography.BodyXSExtensive;
    const {
      Text: { TextPrimary },
    } = theme.palette;
    return {
      background: snackbarColors[severity],
      color: TextPrimary,
      ...font,

      '& svg[data-testid*="CloseIcon"]': {
        fontSize: 16,
      },

      '& svg': {
        color: iconColors[severity],
        fontSize: 20,
      },

      '& .dmb-uikit-MuiAlert-icon': {
        paddingTop: theme.spacing(1),
        marginRight: 0,
      },

      '& .dmb-uikit-MuiAlert-action': {
        padding: 0,
      },

      '& .dmb-uikit-MuiAlert-message': {
        paddingLeft: theme.spacing(3),
      },
    };
  };
