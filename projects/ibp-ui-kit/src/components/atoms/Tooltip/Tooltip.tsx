import React, { memo, useMemo } from 'react';
import { SxProps, Tooltip as MuiTooltip } from '@mui/material';

import { ContainerPosition } from '@/types';
import { getDataTestId, mergeSx, trimTextLength } from '@/utils';

import { SxBox } from '../SxBox';

import { getArrowStyles, getTooltipStyles, popperMarginProps, toolTipContainerStyles } from './Tooltip.styles';
import { ArrowPosition, DisabledListener, TooltipPosition, TooltipProps } from './Tooltip.types';
import { isHorizontalPlacement, isVerticalPlacement } from './Tooltip.utils';

const getActualPlacement = (position: TooltipPosition, arrow: ArrowPosition): ContainerPosition => {
  if (isHorizontalPlacement(position)) {
    if (arrow === 'left') return `${position}-start`;
    if (arrow === 'right') return `${position}-end`;
  }
  if (isVerticalPlacement(position)) {
    if (arrow === 'top') return `${position}-start`;
    if (arrow === 'bottom') return `${position}-end`;
  }
  return position;
};

export const Tooltip = memo(
  ({
    arrow = 'center',
    children,
    dataTestId,
    disabled = false,
    isHint = false,
    trimmingLength = 560,
    enterDelay = 1000,
    open,
    placement = 'bottom',
    arrowSx,
    sx,
    title,
    type,
    arrowShift,
  }: TooltipProps) => {
    const tooltipType = type ?? (isHint ? 'hint' : 'default');

    const tooltipStyle = useMemo(() => mergeSx(getTooltipStyles({ type: tooltipType }), sx), [sx, tooltipType]);

    const arrowStyle = useMemo(
      () =>
        mergeSx(
          getArrowStyles({
            arrow,
            placement,
            type: tooltipType,
            arrowShift,
          }),
          arrowSx,
        ),
      [arrowSx, arrow, tooltipType, placement, arrowShift],
    );

    const disabledProps: DisabledListener = {
      disableFocusListener: disabled,
      disableHoverListener: disabled,
      disableTouchListener: disabled,
    };

    const trimmingTitle = useMemo(() => trimTextLength(title, trimmingLength), [title, trimmingLength]);

    /**
     * sx - crushed in the material - MuiTooltip can't parse object, read it as [Object object]
     * Use style instead of sx
     * */
    return (
      <MuiTooltip
        data-testid={getDataTestId(dataTestId, 'Tooltip')}
        componentsProps={{
          tooltip: { sx: tooltipStyle as SxProps },
          arrow: { sx: arrowStyle as SxProps },
        }}
        enterDelay={enterDelay}
        style={toolTipContainerStyles}
        placement={getActualPlacement(placement, arrow)}
        title={trimmingTitle}
        open={open}
        arrow={arrow !== 'none'}
        {...disabledProps}
        PopperProps={{ sx: popperMarginProps }}
      >
        <SxBox>{children}</SxBox>
      </MuiTooltip>
    );
  },
);

Tooltip.displayName = 'Tooltip';
