import { createContext } from 'react';

export interface RootContextData {
  dataTestId?: string;
}

export const RootContext = createContext<RootContextData>({});
