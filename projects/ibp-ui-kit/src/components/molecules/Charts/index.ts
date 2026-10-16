import 'chart.js/auto';
import { Chart as ChartJS } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

export * from './Bar';
export { Pie } from './Pie';
ChartJS.register(zoomPlugin);
