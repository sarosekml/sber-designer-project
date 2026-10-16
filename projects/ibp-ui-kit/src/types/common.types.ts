import { ReactNode } from 'react';
import { GridSize } from '@mui/material';

export type SizeType = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
/**
 * @TODO Decide which is the common type this one or the one from:
 * /ui-kit/src/components/atoms/gridTiles/types.ts
 */
export type GridSizes = Partial<Record<SizeType | 'all', GridSize>>;
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type MediumSizeType = 'sm' | 'md' | 'lg';
export type InheritableSizeType = MediumSizeType | 'inherit';
export type ViewType = 'read' | 'edit';

export type AlertColors = 'info' | 'success' | 'warning' | 'error';

export type Orientation = 'horizontal' | 'vertical';

export type SeverityType = 'error' | 'info' | 'success' | 'warning';

export type UINodeType = ReactNode | Element[] | Element;

export type JustifyType = 'flex-start' | 'flex-end';

export interface DataTestIdProps {
  dataTestId?: string;
}

export const HorizontalPositionValues = ['left', 'center', 'right'] as const;
export type HorizontalPosition = (typeof HorizontalPositionValues)[number];

export const ContainerPositionValues = [
  'bottom',
  'left',
  'right',
  'top',
  'bottom-end',
  'bottom-start',
  'left-end',
  'left-start',
  'right-end',
  'right-start',
  'top-end',
  'top-start',
] as const;
export type ContainerPosition = (typeof ContainerPositionValues)[number];
