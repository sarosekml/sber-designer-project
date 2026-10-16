import { TooltipProps as TooltipMuiProps } from '@mui/material/Tooltip';

import { ContainerPosition, DataTestIdProps, HorizontalPositionValues } from '@/types';
import { Sx } from '@/utils';

export type DisabledListener = Pick<
  TooltipMuiProps,
  'disableFocusListener' | 'disableHoverListener' | 'disableTouchListener'
>;

export type MuiTooltipProps = Pick<TooltipMuiProps, 'title' | 'children' | 'sx'>;

const ArrowPositionValues = ['none', ...HorizontalPositionValues, 'bottom', 'top'] as const;
export type ArrowPosition = (typeof ArrowPositionValues)[number];

export const TooltipPositionValues = ['bottom', 'left', 'right', 'top'] as const;
export type TooltipPosition = (typeof TooltipPositionValues)[number];

export const TooltipTypes = ['default', 'hint', 'error', 'warning'] as const;
export type TooltipType = (typeof TooltipTypes)[number];

export interface TooltipProps extends MuiTooltipProps, DataTestIdProps {
  arrow?: ArrowPosition;
  arrowSx?: Sx;
  disabled?: boolean;
  /**
   * This parameter is deprecated, use `type: 'hint'` instead.
   * @deprecated
   **/
  isHint?: boolean;
  trimmingLength?: number;
  enterDelay?: number;
  open?: boolean;
  placement?: TooltipPosition;
  type?: TooltipType;
  arrowShift?: string;
}

export interface TooltipStylesProps {
  type: TooltipType;
}

export interface ArrowStylesProps extends TooltipStylesProps {
  arrow: ArrowPosition;
  placement: ContainerPosition;
  type: TooltipType;
  arrowShift?: string;
}
