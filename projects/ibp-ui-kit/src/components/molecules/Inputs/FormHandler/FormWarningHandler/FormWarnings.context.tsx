import { createContext } from 'react';
import { FormWarningsContextData } from './FormWarnings.types';

export const defaultContextData: FormWarningsContextData = {
  warnings: new Map(),
};

export const FormWarningsContext = createContext<FormWarningsContextData>(defaultContextData);
