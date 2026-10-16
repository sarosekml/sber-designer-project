import { TableColorSchema } from '../../TableProps';

export interface HoveredRowData {
  ref: HTMLTableRowElement;
  colorSchema: TableColorSchema;
  index: number;
  data: unknown;
  key: string;
  setForceHovered: (hovered: boolean) => void;
}

export interface RowEvents {
  resize: void;
  hover: HoveredRowData;
  blur: string;
}
