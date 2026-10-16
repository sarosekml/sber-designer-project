import type { Theme } from '@mui/material';

import { DataTestIdProps, MediumSizeType } from '@/types/common.types';
import { Sx } from '@/utils';

export type FloatingButtonType = 'circular' | 'extended';

export interface ButtonColorTheme {
  backgroundColor?: string;
  backgroundColorHover?: string;
}
export type FloatingButtonColorThemeCallback = (theme: Theme) => ButtonColorTheme;
export type FloatingButtonColorThemeSx = FloatingButtonColorThemeCallback | ButtonColorTheme;

export interface FloatingButtonProps extends DataTestIdProps {
  sx?: Sx;
  disabled?: boolean;
  /**
   * gives ability to define two colors background and background on hover.
   * do it through the Sx, so for more complex scenario please use Sx.
   */
  colorThemeSx?: FloatingButtonColorThemeSx;
  size?: MediumSizeType;
  variant?: FloatingButtonType;
  children?: React.ReactNode;
  ariaLabel?: string;
  onClick?: () => void;
}
