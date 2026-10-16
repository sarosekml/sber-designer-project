import { MediumSizeType } from '@/types';
import { Sx } from '@/utils/mergeSx';

import { badgeFontSize, badgeMargin, badgeSize } from './TabBadge.const';

export const getBadgeStyles =
  (size: MediumSizeType, disabled: boolean): Sx =>
  (theme) => ({
    'display': 'inline-flex',
    'fontSize': badgeFontSize[size],
    'backgroundColor': disabled ? theme.palette.Disabled.DisabledBG : theme.palette.Status.StSystemLight,
    'borderRadius': theme.spacing(5),
    'width': 'fit-content',
    'justifyContent': 'center',
    'alignItems': 'center',
    'minWidth': badgeSize[size],
    'height': badgeSize[size],
    'p': 0,
    'px': '5px',
    'ml': badgeMargin[size],
    'color': disabled ? theme.palette.Text.TextInactive : theme.palette.Text.TextPrimary,
    '&:hover': {
      backgroundColor: theme.palette.Border.BorderPrimary,
      pointerEvents: 'none',
    },
  });
