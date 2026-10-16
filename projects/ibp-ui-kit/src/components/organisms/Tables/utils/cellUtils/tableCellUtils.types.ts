import { Dictionary } from '@sber-ibp/core';

export type LocalTableRowData<T extends Dictionary> = string | string[] | T[];

export interface MarkerListArgs<T extends Dictionary> {
  dictionaries?: T[];
  dictionaryKey?: keyof T;
  value?: LocalTableRowData<T> | null;
  cutLength?: number;
  isTooltipColumnView?: boolean;
}
