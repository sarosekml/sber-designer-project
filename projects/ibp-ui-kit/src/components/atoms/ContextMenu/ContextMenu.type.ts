import React from 'react';
import { PopoverOrigin } from '@mui/material/Popover/Popover';

import { DataTestIdProps, MediumSizeType } from '@/types/common.types';

export type ItemValue = string | number;

export interface ContextMenuItem {
  action?: () => void;
  isDisabled?: boolean;
  selected?: boolean;
  value: ItemValue;
}

export interface ContextMenuProps extends DataTestIdProps {
  items: ContextMenuItem[];
  contextMenuList: HTMLElement | null;
  closeMenu: (item: ContextMenuItem) => void;
  onBackdropClick?: (e: React.SyntheticEvent<HTMLElement>) => void;
  selectHandler: (item: ContextMenuItem, e: React.SyntheticEvent<HTMLElement>) => void;
  size?: MediumSizeType;
  minWidth?: number;
  anchorMenu?: PopoverOrigin;
  transformMenu?: PopoverOrigin;
  isSelectedShown?: boolean;
}

export interface ContextMenuStyleProps {
  size?: MediumSizeType;
  minWidth?: number;
}
