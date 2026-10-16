import { Theme } from '@mui/material';

import { IconColors } from '../Icon/Icon.types';

export const getIconButtonColors = (theme: Theme) => {
  const alertColors: Record<IconColors, string> = {
    inherit: 'inherit',
    action: theme.palette.Primary.PrimaryLight,
    disabled: theme.palette.Disabled.Disabled,
    primary: theme.palette.Primary.Primary,
    secondary: theme.palette.Secondary.Secondary,
    error: theme.palette.Error.Error,
    info: theme.palette.Info.InfoBlue,
    success: theme.palette.Success.Success,
    warning: theme.palette.Warning.Warning,
  };

  const alertHoverColors: Record<IconColors, string> = {
    ...alertColors,
    error: theme.palette.Error.ErrorDark,
    info: theme.palette.Info.InfoDark,
    success: theme.palette.Success.SuccessDark,
    warning: theme.palette.Warning.WarningDark,
  };

  return {
    alertColors,
    alertHoverColors,
    alertRippleColors: alertHoverColors,
  };
};
