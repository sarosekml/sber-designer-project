import { ChartOptions, InteractionItem, PointStyle, TooltipItem, ChartData, InteractionMode } from 'chart.js';
import { Mode } from 'chartjs-plugin-zoom/types/options';

export interface BarParams {
  showXGrid?: boolean;
  showLegend?: boolean;
  pointStyle?: PointStyle;
  interactionMode?: InteractionMode;
  tooltipTitleCallback?: (context: TooltipItem<'bar'>[]) => string | string[] | undefined;
  tooltipLabelCallback?: (context: TooltipItem<'bar'>) => string | string[] | undefined;
  positionYScales?: 'left' | 'right';
  lineWidth?: number;
  lineZeroWidth?: number;
  lineColor?: string;
  lineZeroColor?: string;
  disabledZoom?: boolean;
  maintainAspectRatio?: boolean;
  zoomMode?: Mode;
  displayMax?: number;
}

export interface BarProps {
  data: ChartData<'bar' | 'line'>;
  params?: BarParams;
  options?: ChartOptions<'bar'>;
  dataTestId: string;
  onClick?: (items: InteractionItem[]) => void;
  width?: string;
  height?: string;
}
