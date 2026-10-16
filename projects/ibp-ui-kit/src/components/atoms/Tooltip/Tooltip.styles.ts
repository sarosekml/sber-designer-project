import { CSSProperties } from 'react';

import { cssImportant, Sx } from '@/utils';

import { ArrowStylesProps, TooltipStylesProps } from './Tooltip.types';
import { isArrowLeftOrRight, isHorizontalPlacement } from './Tooltip.utils';

export const getTooltipStyles =
  ({ type }: TooltipStylesProps): Sx =>
  (theme) => ({
    padding: theme.spacing(2, 3),
    ...theme.typography.BodySReg,
    borderRadius: theme.spacing(1),

    ...(type === 'hint'
      ? {
          color: theme.palette.Text.TextOnDark,
          backgroundColor: theme.palette.BG.BGHint,
        }
      : {}),
    ...(type === 'error'
      ? {
          color: theme.palette.error.contrastText,
          backgroundColor: theme.palette.Error.Error,
        }
      : {}),
    ...(type === 'warning'
      ? {
          color: theme.palette.error.contrastText,
          backgroundColor: theme.palette.Warning.Warning,
        }
      : {}),
    ...(type === 'default'
      ? {
          color: theme.palette.Text.TextOnTertiary,
          backgroundColor: theme.palette.Tertiary.Tertiary,
        }
      : {}),
  });

export const getArrowStyles =
  ({ arrow, placement, type, arrowShift = '12px' }: ArrowStylesProps): Sx =>
  (theme) => {
    return {
      color:
        type === 'hint'
          ? theme.palette.BG.BGHint
          : type === 'error'
          ? theme.palette.Error.Error
          : type === 'warning'
          ? theme.palette.Warning.Warning
          : theme.palette.Tertiary.Tertiary,

      ...(isHorizontalPlacement(placement) && {
        ...(isArrowLeftOrRight(arrow) && {
          transform: 'none !important',
          left: 'initial !important',
          ...(arrow === 'left' && {
            left: `${arrowShift} !important`,
          }),
          ...(arrow === 'right' && {
            right: arrowShift,
          }),
        }),
      }),
    };
  };

/** @todo find way to pass style to Popper without !important */
export const popperMarginProps: Sx = (theme) => ({
  '.dmb-uikit-MuiTooltip-tooltip': {
    '&.dmb-uikit-MuiTooltip-tooltipPlacementTop': {
      marginBottom: cssImportant(theme.spacing(1.75)),
    },
    '&.dmb-uikit-MuiTooltip-tooltipPlacementBottom': {
      marginTop: cssImportant(theme.spacing(1.75)),
    },
    '&.dmb-uikit-MuiTooltip-tooltipPlacementRight': {
      marginLeft: cssImportant(theme.spacing(1.75)),
    },
    '&.dmb-uikit-MuiTooltip-tooltipPlacementLeft': {
      marginRight: cssImportant(theme.spacing(1.75)),
    },
  },
});

/**
 * Tooltip can change nested component width, it is not correct behavior.
 * If tooltip have full container width, it is clarifying, and we can control it.
 * */
export const toolTipContainerStyles: CSSProperties = {
  width: '100%',
};
