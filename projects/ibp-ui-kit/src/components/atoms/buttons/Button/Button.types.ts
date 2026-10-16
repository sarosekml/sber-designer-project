import React, { ReactNode } from 'react';

import { AlertColors, ButtonSize, DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

import { IconName } from '../../Icon';

export type ButtonHtmlTypes = 'submit' | 'button' | 'reset';
export type ButtonType = 'outlined' | 'accent' | 'transparent';
export type DefaultButtonColors = 'default' | 'primary' | 'secondary';
export type ButtonColors = AlertColors | DefaultButtonColors;

export type ContentVariant =
  | 'onlyText'
  | 'textAndStartIcon'
  | 'textAndEndIcon'
  | 'textAndBothIcons'
  | 'textAndLoader'
  | 'onlyIcon';
export type ButtonIconStyles = Record<'root' | 'startIcon' | 'endIcon', Sx>;

export interface ButtonProps extends DataTestIdProps {
  id?: string;
  type?: ButtonType;
  children?: ReactNode;
  className?: string;
  size?: ButtonSize;
  startIcon?: IconName;
  endIcon?: IconName;
  disabled?: boolean;
  hasLoader?: boolean;
  htmlType?: ButtonHtmlTypes;
  form?: string;
  fullWidth?: boolean;
  onClick?: (e: React.SyntheticEvent<HTMLElement>) => void;
  sx?: Sx;
  color?: ButtonColors;
}

export interface ButtonStyledProps {
  color: ButtonColors;
  fullWidth?: boolean;
  size: ButtonSize;
  hasChildren: boolean;
  type?: ButtonType;
  contentVariant: ContentVariant;
  hasLoader?: boolean;
}

export interface OutlineButtonColorScheme {
  borderColor?: string;
  backgroundColor?: string;
  color?: string;
}
