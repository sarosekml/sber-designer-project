/* eslint-disable @typescript-eslint/no-explicit-any */
import { MouseEventHandler, Ref } from 'react';

import { DataTestIdProps, MediumSizeType } from '@/types';
import { Sx } from '@/utils';

import { IconName, IconPresetColors } from '../Icon/Icon.types';

export type IconButtonColors = Extract<IconPresetColors, 'error' | 'warning' | 'success' | 'info'>;

/**
 * Need to correct working IconButton with DnD
 */
export type DraggableProvidedDragHandleProps = {
  'data-rbd-drag-handle-draggable-id': string;
  'data-rbd-drag-handle-context-id': string;
  'aria-describedby': string;

  role: string;
  tabIndex: number;
  draggable: boolean;
  onDragStart: React.DragEventHandler<any>;
};

export interface IconButtonProps extends DataTestIdProps {
  name: IconName;
  size?: MediumSizeType;
  color?: IconButtonColors;
  ref?: Ref<any>;
  disabled?: boolean;
  sx?: Sx;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  title?: string;
  draggableProps?: DraggableProvidedDragHandleProps;
}

export type IconButtonStyleProps = Pick<IconButtonProps, 'color' | 'size' | 'disabled'>;
