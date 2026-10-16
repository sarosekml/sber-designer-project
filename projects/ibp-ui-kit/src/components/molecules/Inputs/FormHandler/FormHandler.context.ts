import { createContext } from 'react';
import { TypeInputHandlerProps } from './FormHandler.types';

export type FormHandlerContextData = TypeInputHandlerProps;
export const defaultFormHandlerContextData = {};
export const FormHandlerContext = createContext<FormHandlerContextData>(defaultFormHandlerContextData);
