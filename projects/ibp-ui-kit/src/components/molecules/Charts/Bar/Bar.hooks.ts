import { MouseEvent, useCallback, useMemo, useRef } from 'react';
import { ChartData, InteractionItem, ChartOptions, ScriptableScaleContext } from 'chart.js';
import { getElementsAtEvent } from 'react-chartjs-2';
import { ChartJSOrUndefined } from 'react-chartjs-2/dist/types';
import { defaultBarConfig, tooltipDefaultOptions } from './Bar.const';
import { getMax, getMin } from './Bar.utils';
import { BarParams } from './Bar.types';

export const useBar = (onClick?: (items: InteractionItem[]) => void) => {
  const chartRef = useRef<ChartJSOrUndefined<'bar'>>();
  const onClickHandler = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!chartRef?.current || !onClick) return;
      const items = getElementsAtEvent(chartRef.current, event);
      onClick(items);
    },
    [chartRef, onClick],
  );
  return { chartRef, onClickHandler };
};

export const useBarOptions = (data: ChartData<'bar' | 'line'>, params?: BarParams): ChartOptions<'bar'> => {
  const values = useMemo(() => data.datasets.flatMap((item) => item.data.flat()), [data]);
  const max = useMemo(() => getMax(values), [values]);
  const min = useMemo(() => getMin(values), [values]);

  const disabledZoom = Boolean(params?.disabledZoom);
  const getLineWidth = useCallback(
    (context: ScriptableScaleContext) => {
      return context.tick.value === 0
        ? params?.lineZeroWidth ?? defaultBarConfig.LineZeroWidth
        : params?.lineWidth ?? defaultBarConfig.LineWidth;
    },
    [params],
  );
  const getLineColor = useCallback(
    (context: ScriptableScaleContext) => {
      return context.tick.value === 0
        ? params?.lineZeroColor ?? defaultBarConfig.LineZeroColor
        : params?.lineColor ?? defaultBarConfig.LineColor;
    },
    [params],
  );

  return {
    maintainAspectRatio: params?.maintainAspectRatio ?? defaultBarConfig.MaintainAspectRatio,
    plugins: {
      tooltip: {
        ...tooltipDefaultOptions,
        callbacks: {
          title: params?.tooltipTitleCallback,
          label: params?.tooltipLabelCallback,
        },
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: !disabledZoom,
          },
          pinch: {
            enabled: !disabledZoom,
          },
          mode: params?.zoomMode ?? defaultBarConfig.ZoomMode,
        },
        pan: {
          enabled: !disabledZoom,
          mode: params?.zoomMode ?? defaultBarConfig.ZoomMode,
          threshold: 5,
        },
      },
      legend: {
        display: Boolean(params?.showLegend),
      },
    },
    interaction: {
      mode: params?.interactionMode ?? defaultBarConfig.InteractionMode,
    },
    elements: {
      point: {
        pointStyle: params?.pointStyle ?? defaultBarConfig.PointStyle,
      },
    },
    scales: {
      y: {
        min: min,
        max: max,
        position: params?.positionYScales ?? defaultBarConfig.PositionYScales,
        grid: {
          lineWidth: getLineWidth,
          color: getLineColor,
        },
      },
      x: {
        type: 'category',
        min: 0,
        max: params?.displayMax ?? defaultBarConfig.DisplayMax,
        grid: {
          display: Boolean(params?.showXGrid),
        },
      },
    },
  };
};
