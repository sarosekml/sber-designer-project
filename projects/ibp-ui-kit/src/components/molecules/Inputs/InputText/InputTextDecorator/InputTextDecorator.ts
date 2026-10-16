import {
  DecoratedValue,
  InputDecorator,
  RawValue,
} from '@/components/molecules/Inputs/InternalComponents/InputDecoratedText/InputDecorator.types';

import { EventDataInitializeParams, InputTextDecoratorOptions } from '../InputText.types';

/**
 * The system analytic is here:
 * @see https://confluence.sberbank.ru/x/EIFTrAI
 */
const singleLineReplaceRegexp = /(^[&\s;),])|([\t\r\n\0\\|])|(%00)/gim;
const multilineReplaceRegexp = /(^[&\s;),])|([\t\r\0\\|])|(%00)/gi;

export const replaceDisallowedSymbols = (value: string, multiline?: boolean): string => {
  let currentValue: string;
  let newValue = value;
  const replaceRegexp = multiline ? multilineReplaceRegexp : singleLineReplaceRegexp;
  do {
    currentValue = newValue;
    newValue = currentValue.replaceAll(replaceRegexp, '');
  } while (currentValue !== newValue);
  return newValue;
};

/**
 * Method for save input cursor in the current position.
 * Stop default logic to move it in the end of string
 * */
const selectionCalculation = ({ selection, rawValue, decoratedValue }: EventDataInitializeParams) => {
  if (rawValue.length > decoratedValue.length) {
    selection = selection === 0 ? 0 : selection - 1;
  }
  return selection;
};

export const getInputTextDecorator = (options: InputTextDecoratorOptions): InputDecorator<string> => {
  return {
    calcNewCursorPosition(value: DecoratedValue, rawValue: RawValue, selection: number): number {
      if (!rawValue || !value) return 0;
      return selectionCalculation({ selection, rawValue, decoratedValue: value });
    },
    valueFromDecorated(value: DecoratedValue): string | null {
      if (!value) return null;
      return value;
    },
    rawValueToDecorated(value: RawValue): DecoratedValue {
      if (!value) return null;
      return replaceDisallowedSymbols(String(value), options.multiline);
    },
    externalValueToDecorated(value: string | null): DecoratedValue {
      if (!value) return null;
      return replaceDisallowedSymbols(String(value), options.multiline);
    },
  };
};
