import { Sx } from '@/utils';

import { RangeLineWidth } from './RangeLine.const';
import { RangeLineProps } from './RangeLine.types';

const getRangeLineWidth =
  ({ size }: RangeLineProps) =>
  (theme) =>
    size ? theme.spacing(RangeLineWidth[size]) : theme.spacing(RangeLineWidth.md);

const getRangeLineColor =
  ({ disabled }: RangeLineProps) =>
  (theme) => ({
    border: `0.7px solid ${disabled ? theme.palette.Disabled.DisabledBorder : theme.palette.Border.BorderPrimary}`,
  });

export const RangeLineWStyles =
  ({ size, disabled }: RangeLineProps): Sx =>
  (theme) => ({
    width: getRangeLineWidth({ size })(theme),
    minWidth: getRangeLineWidth({ size })(theme),
    border: getRangeLineColor({ disabled })(theme),
    height: 0,
  });
