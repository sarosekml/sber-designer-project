import { theme } from '@/styles';

import { BadgeColorThemeSx } from '../DictionaryBadge';

import { ProblemZoneType } from './RiskMetricsBadge.types';

export const defaultColorSchemas: Record<ProblemZoneType | 'Default', BadgeColorThemeSx> = {
  'Black Zone': {
    backgroundColor: theme.palette.Status.StGrey,
    textColor: theme.palette.Text.TextOnDark,
  },
  Default: {
    backgroundColor: theme.palette.BG.BGTile,
    borderColor: theme.palette.Tertiary.TertiaryDark,
    textColor: theme.palette.Tertiary.TertiaryDark,
  },
  'Green Zone': {
    backgroundColor: theme.palette.Status.StGreenLight,
    textColor: theme.palette.Status.StGreenDark,
  },
  'Red Zone': {
    backgroundColor: theme.palette.Status.StRed,
    textColor: theme.palette.Text.TextOnDark,
  },
  Watchlist: {
    backgroundColor: theme.palette.Status.StOrangeLight,
    textColor: theme.palette.Status.StOrangeDark,
  },
};
