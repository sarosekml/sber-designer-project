import { MouseEventHandler, ReactNode } from 'react';
import { Theme } from '@mui/material';

import { MediumSizeType } from '@/types';
import { DataTestIdProps, GridSizes } from '@/types/common.types';
import { Sx } from '@/utils';

export type TileSize = MediumSizeType | 'xs';

export interface TileHeaderProps extends DataTestIdProps {
  title?: string;
  subtitle?: ReactNode;
  titlePostfix?: ReactNode;
  subtitlePostfix?: ReactNode;
  actions?: ReactNode;
  size: TileSize;
  hasSpot?: boolean;
}

export interface TileCardProps extends Omit<TileHeaderProps, 'size'> {
  isHighlighted?: boolean;
  alert?: ReactNode;
  children?: ReactNode;
  headless?: boolean;
  variant?: 'elevation' | 'outlined';
  onDoubleClick?: MouseEventHandler;
  size?: TileSize;
  sx?: Sx;
  scrollEnabled?: boolean;
}

export interface TileProps extends TileCardProps {
  gridSizes?: GridSizes;
}

export interface AccordionTileProps extends Omit<TileHeaderProps, 'size'> {
  alert?: ReactNode;
  accordionSummary?: ReactNode;
  accordionContent?: ReactNode;
  isExpanded?: boolean;
  disabled?: boolean;
  gridSizes?: GridSizes;
  hasSpot?: boolean;
  isDragAndDropContainer?: boolean;
  onExpand?: (isExpanded: boolean) => void;
  dragAndDropContainerState?: 'default' | 'active' | 'disabled';
  size: MediumSizeType;
}

export interface DraggableTileProps extends DataTestIdProps {
  title?: string;
  subtitle?: string;
  isDisabled?: boolean;
  onDoubleClick?: MouseEventHandler;
  children?: ReactNode;
  sx?: Sx;
}

export interface DraggableStyleProps {
  theme: Theme;
  isDisabled?: boolean;
}
