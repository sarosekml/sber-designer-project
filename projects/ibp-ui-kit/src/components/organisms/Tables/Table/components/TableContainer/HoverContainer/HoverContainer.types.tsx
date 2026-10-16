import { HoverConfig } from '../../../TableProps';

export interface HoverContainerProps extends HoverConfig<object> {
  tableCode: string;
}

export interface HoverBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
