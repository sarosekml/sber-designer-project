import { useMemo } from 'react';
import { getInputNumberDecorator } from './InputNumberDecorator/InputNumberDecorator';
import { FilledDigitsConfig, InputNumberProps } from './InputNumber.types';
import { defaultDigitsConfig } from './InputNumberDecorator/InputNumberDecorator.const';

export const useInputNumberDecorator = ({
  minFractionDigits = defaultDigitsConfig.minFractionDigits,
  minIntegerDigits = defaultDigitsConfig.minIntegerDigits,
  maxFractionDigits = defaultDigitsConfig.maxFractionDigits,
  maxIntegerDigits = defaultDigitsConfig.maxIntegerDigits,
  maxSymbols = defaultDigitsConfig.maxSymbols,
  multiplier,
  thousandSeparator = true,
}: InputNumberProps) => {
  const multiplierValue = multiplier === 0 || !multiplier ? 1 : multiplier;

  const filledDigitsConfig = useMemo<FilledDigitsConfig>(
    () => ({ maxFractionDigits, maxIntegerDigits, maxSymbols, minFractionDigits, minIntegerDigits }),
    [maxFractionDigits, maxIntegerDigits, maxSymbols, minFractionDigits, minIntegerDigits],
  );

  return useMemo(
    () =>
      getInputNumberDecorator({
        digitsConfig: filledDigitsConfig,
        thousandSeparator,
        multiplier: multiplierValue,
      }),
    [filledDigitsConfig, multiplierValue, thousandSeparator],
  );
};
