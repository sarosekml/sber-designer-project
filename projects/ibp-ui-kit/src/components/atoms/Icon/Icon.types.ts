import { DataTestIdProps, InheritableSizeType } from '@/types';
import { Sx } from '@/utils';

import { iconsMap } from './Icon.const';

export type IconName = keyof typeof iconsMap;

export type IconPresetColors =
  | 'inherit'
  | 'action'
  | 'disabled'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

export type IconColors = IconPresetColors | string;

export interface IconProps extends DataTestIdProps {
  /** Use any colors from palette or any colors from web colors */
  color?: IconColors;
  name: IconName;
  className?: string;
  onClick?: () => void;
  size?: InheritableSizeType;
  sx?: Sx;
}
