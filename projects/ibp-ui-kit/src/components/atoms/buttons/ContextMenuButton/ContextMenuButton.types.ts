import React from 'react';
import { PopoverOrigin } from '@mui/material/Popover/Popover';

import { DataTestIdProps, MediumSizeType } from '@/types/common.types';
import { SxProps } from '@/utils';

import { ContextMenuItem } from '../../ContextMenu';
import { IconName } from '../../Icon';
import { ButtonType } from '../Button/Button.types';

export type ContextMenuButtonTypes = 'transparent' | 'outlined';

export interface GeneralContextMenuButtonProps {
  anchorMenu?: PopoverOrigin;
  disabled?: boolean;
  /** @deprecated Use disabled */
  isButtonDisabled?: boolean;
  items: ContextMenuItem[];
  minWidth?: number;
  onSelectItem: (item: ContextMenuItem) => void;
  sx?: SxProps;
  transformMenu?: PopoverOrigin;
  onButtonClick?: (e: React.SyntheticEvent<HTMLElement>) => void;
  onBackdropClick?: (e: React.SyntheticEvent<HTMLElement>) => void;
  isSelectedShown?: boolean;
}

export interface ContextMenuButtonPropsButtonPreset {
  icon?: IconName;
  label?: string;
  size?: MediumSizeType;
  type?: ButtonType;
  viewType?: 'button';
}

export interface ContextMenuButtonPropsIconPreset {
  icon: IconName;
  size?: MediumSizeType;
  type?: ContextMenuButtonTypes;
  viewType?: 'icon';
}

export type ContextMenuButtonProps = DataTestIdProps &
  GeneralContextMenuButtonProps &
  (ContextMenuButtonPropsButtonPreset | ContextMenuButtonPropsIconPreset);
