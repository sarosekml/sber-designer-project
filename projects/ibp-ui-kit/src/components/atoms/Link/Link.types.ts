import { MouseEvent } from 'react';
import { LinkProps as MuiLinkProps, LinkTypeMap } from '@mui/material';

import { theme } from '@/styles';
import { DataTestIdProps, MediumSizeType } from '@/types';

export interface LinkStyledProps {
  disabled?: boolean;
  size?: MediumSizeType;
  severity?: Severity;
}

export type LinkProps<D extends React.ElementType = LinkTypeMap['defaultComponent'], P = object> = DataTestIdProps &
  MuiLinkProps<D, P> &
  LinkStyledProps & {
    innerRef?: React.Ref<any>;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  };

export type Severity =
  | 'breadcrumbs1'
  | 'breadcrumbs2'
  | 'default'
  | 'error'
  | 'info'
  | 'success'
  | 'warning'
  | 'products';

export const defaultColors: Record<Severity, string> = {
  breadcrumbs1: theme.palette.Text.TextSecondary,
  breadcrumbs2: theme.palette.Text.TextPrimary,
  default: theme.palette.Primary.Primary,
  error: theme.palette.Error.Error,
  info: theme.palette.Info.Info,
  success: theme.palette.Success.Success,
  warning: theme.palette.Warning.Warning,
  products: theme.palette.Text.TextPrimary,
};

export const hoverColors: Record<Severity, string> = {
  breadcrumbs1: theme.palette.Text.TextPrimary,
  breadcrumbs2: theme.palette.Text.TextBlack,
  default: theme.palette.Primary.PrimaryDark,
  error: theme.palette.Error.ErrorDark,
  info: theme.palette.Info.InfoDark,
  success: theme.palette.Success.SuccessDark,
  warning: theme.palette.Warning.WarningDark,
  products: theme.palette.Primary.Primary,
};

export const disabledColors: Record<Severity, string> = {
  breadcrumbs1: theme.palette.Text.TextInactive,
  breadcrumbs2: theme.palette.Text.TextInactive,
  default: theme.palette.Text.TextInactive,
  error: theme.palette.Text.TextInactive,
  info: theme.palette.Text.TextInactive,
  success: theme.palette.Text.TextInactive,
  warning: theme.palette.Text.TextInactive,
  products: theme.palette.Text.TextInactive,
};
