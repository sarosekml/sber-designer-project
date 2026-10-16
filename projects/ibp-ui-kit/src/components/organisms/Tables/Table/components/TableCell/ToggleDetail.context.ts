import { createContext } from 'react';

export interface ToggleDetailContextData<RowType extends object> {
  showToggleIcon?: (row: RowType) => boolean;
}

export const ToggleDetailContext = createContext<ToggleDetailContextData<any>>({});
