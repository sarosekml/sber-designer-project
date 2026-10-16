import { InteractionMode, PointStyle, TooltipOptions } from 'chart.js/dist/types';
import { Mode } from 'chartjs-plugin-zoom/types/options';

import { theme } from '@/styles';

const {
  secondary: { main },
  Tertiary: { Tertiary },
  Disabled: { DisabledBorder },
  Text: { TextSecondary },
} = theme.palette;

export const tooltipDefaultOptions: Partial<TooltipOptions<'bar'>> = {
  caretSize: 0,
  cornerRadius: 3,
  displayColors: false,
  bodyColor: main,
  titleColor: main,
  backgroundColor: Tertiary,
  padding: 12,
};

interface DefaultBarTypes {
  LineWidth: number;
  LineZeroWidth: number;
  PointStyle: PointStyle;
  InteractionMode: InteractionMode;
  PositionYScales: 'left' | 'right';
  LineColor: string;
  LineZeroColor: string;
  MaintainAspectRatio: boolean;
  ZoomMode: Mode;
  DisplayMax: number;
}

export const defaultBarConfig: DefaultBarTypes = {
  LineWidth: 1,
  LineZeroWidth: 1,
  PointStyle: false,
  InteractionMode: 'index',
  PositionYScales: 'right',
  LineColor: DisabledBorder,
  LineZeroColor: TextSecondary,
  MaintainAspectRatio: false,
  ZoomMode: 'xy',
  DisplayMax: 15,
};
