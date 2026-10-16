import * as React from 'react';

import { ButtonColors, ButtonType } from '@/components/atoms';
import { ButtonSize } from '@/types';

export type ButtonGroupOrientation = 'vertical' | 'horizontal';

export interface ButtonGroupProps extends ButtonGroupButtonProps {
  children?: React.ReactNode;
  orientation?: ButtonGroupOrientation;
}

export interface ButtonGroupButtonProps {
  disabled?: boolean;
  size?: ButtonSize;
  type?: ButtonType;
  fullWidth?: boolean;
  color?: ButtonColors;
  className?: string;
}

export interface ButtonGroupButtonContext extends ButtonGroupButtonProps {
  isGrouped?: boolean;
}
