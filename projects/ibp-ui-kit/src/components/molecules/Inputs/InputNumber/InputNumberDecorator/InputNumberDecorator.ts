import {
  DecoratedValue,
  InputDecorator,
  RawValue,
} from '@/components/molecules/Inputs/InternalComponents/InputDecoratedText/InputDecorator.types';

import { InputNumberDecoratorType } from './InputNumberDecorator.types';
import {
  countSelectionPosition,
  countValueWithDivider,
  countValueWithMultiplier,
  decorateRawValue,
  negativeZeroHandler,
  normalizeValue,
} from './InputNumberDecorator.utils';

export const getInputNumberDecorator = ({
  digitsConfig,
  thousandSeparator,
  multiplier,
}: InputNumberDecoratorType): InputDecorator<number> => {
  return {
    calcNewCursorPosition(decoratedValue: DecoratedValue, rawValue: RawValue, selection: number): number {
      if (!rawValue || !decoratedValue) return selection;
      return countSelectionPosition(rawValue, decoratedValue, selection);
    },
    valueFromDecorated(value: DecoratedValue): number | null {
      if (!value) return null;
      return multiplier !== 1
        ? countValueWithDivider(value, multiplier)
        : Number(normalizeValue(value).normalizedNumericValue);
    },
    rawValueToDecorated(value: RawValue, selection?: number): DecoratedValue {
      if (!value) return null;
      const decoratedValue = decorateRawValue(value, digitsConfig, thousandSeparator, selection);
      return !decoratedValue ? null : decoratedValue;
    },
    externalValueToDecorated(value: number | null): DecoratedValue {
      if (!value && value !== 0) return null;
      const multipliedValue = multiplier !== 1 ? countValueWithMultiplier(value, multiplier) : value;

      return decorateRawValue(negativeZeroHandler(multipliedValue), digitsConfig, thousandSeparator, undefined);
    },
  };
};
