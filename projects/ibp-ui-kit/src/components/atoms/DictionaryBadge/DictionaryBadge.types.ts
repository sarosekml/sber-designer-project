import { MouseEvent, ReactElement, ReactNode } from 'react';
import type { Theme } from '@mui/material';

import { Dictionary } from '@sber-ibp/core';

import { DataTestIdProps, MediumSizeType, ViewType } from '@/types/common.types';
import { Sx } from '@/utils';

/**
 * @deprecated 'filled' is deprecated, please use 'outlined' instead
 */
export type BadgeStyleVariant = 'filled' | 'outlined' | 'transparent';
export type BadgeComponent = 'Marker' | 'Chip';

export interface BadgeColorTheme {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  backgroundColorHover?: string;
  borderColorHover?: string;
  textColorHover?: string;
}

export type BadgeColorScheme = Record<
  'base' | 'hover' | 'disabled' | 'active' | 'activeHover',
  { backgroundColor?: string; borderColor?: string; color?: string }
>;

export type BadgeColorThemeCallback = (theme: Theme) => BadgeColorTheme;
export type BadgeColorThemeSx = BadgeColorThemeCallback | BadgeColorTheme;

export interface DictionaryBadgeProps extends Dictionary, DataTestIdProps {
  /**
   * @default 'outlined'
   */
  variant?: BadgeStyleVariant;
  /**
   * @default undefined
   */
  colorThemeSx?: BadgeColorThemeSx;
  /**
   * @default 'edit'
   */
  type?: ViewType;
  /**
   * Defines the asset of styles applied to the component
   */
  component: BadgeComponent;
  /**
   * @default 'md'
   */
  size?: MediumSizeType;
  /**
   * @default false
   */
  disabled?: boolean;
  /**
   * @default false
   */
  active?: boolean;
  /**
   * Event which is called in response to badge click
   */
  onClick?: (value: Dictionary, e: MouseEvent) => void;
  /**
   * Event which is called in response to cross icon click on a badge
   */
  onDelete?: (value: Dictionary, e: MouseEvent) => void;
  /**
   * CSS Class which is set for the Material UI Chip component
   * it can be used for complex constructions which includes
   * the DictionaryBadgeComponent, when you define the root Sx.
   */
  className?: string;
  /**
   * Sx
   */
  sx?: Sx;
  /**
   * Tooltip container sx
   */
  containerSx?: Sx;
  /**
   * The react element before the badge text
   */
  startIcon?: ReactElement;
  /**
   * The react element after the badge text
   * substituted by the delete icon if `onDelete` is provided
   */
  endIcon?: ReactElement;
  /**
   * Shows the tooltip for content of the element
   * @default true (for component === 'Marker')
   * @default false (for component === 'Chip')
   */
  showContentTooltip?: boolean;
  /**
   * Props to stop hovering if we need static chip or marker component
   * @default true
   */
  hoverable?: boolean;
  /**
   * Props to show tooltip
   */
  tooltip?: {
    content: ReactNode;
  };
}

export interface DictionaryBadgeStyleProps {
  variant: BadgeStyleVariant;
  type: ViewType;
  size: MediumSizeType;
  colorThemeSx?: BadgeColorThemeSx;
  disabled: boolean;
  active: boolean;
  hasDeleteButton: boolean;
  sx?: Sx;
  hoverable?: boolean;
  component: BadgeComponent;
  hasPostfix: boolean;
}

export type StyleForSize<T> = {
  [size in MediumSizeType]: T;
};

export type StyleVariants<T> = Record<ViewType, StyleForSize<T>>;
