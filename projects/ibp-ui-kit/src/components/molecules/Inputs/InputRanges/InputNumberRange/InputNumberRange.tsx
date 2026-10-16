import React, { memo, useCallback, useState } from 'react';

import { SxBox } from '@/components/atoms/SxBox';
import { Sx } from '@/utils';

import { InputNumber } from '../../InputNumber/InputNumber';
import { InputTemplate } from '../../InputTemplate';
import { RangeLine } from '../../InternalComponents/RangeLine/RangeLine';
import { InputNumberRangeProps } from '../InputRange.types';

const root = 'InputNumberRange';

const inputNumberRangeSx: Sx = { display: 'flex', alignItems: 'center', gap: 1, width: '100%' };

export const InputNumberRange = memo(
  ({
    dataTestId,
    helperText,
    value,
    size,
    disabled,
    label,
    labelOptions,
    onChange,
    onClear,
    ...props
  }: InputNumberRangeProps) => {
    const [valueFrom, setValueFrom] = useState(value.from ?? null);
    const [valueTo, setValueTo] = useState(value.to ?? null);

    const onChangeMin = useCallback(
      (value: number | null) => {
        setValueFrom(value);
        onChange?.({ from: value, to: valueTo });
      },
      [onChange, valueTo],
    );

    const onChangeMax = useCallback(
      (value: number | null) => {
        setValueTo(value);
        onChange?.({ from: valueFrom, to: value });
      },
      [onChange, valueFrom],
    );

    const onClearMin = useCallback(() => {
      setValueFrom(null);
      onClear?.({ from: null, to: valueTo });
    }, [onClear, valueTo]);

    const onClearMax = useCallback(() => {
      setValueTo(null);
      onClear?.({ from: valueFrom, to: null });
    }, [onClear, valueFrom]);

    return (
      <InputTemplate
        label={label}
        labelOptions={labelOptions}
        dataTestId={dataTestId}
        disabled={disabled}
        helperText={helperText}
      >
        <SxBox sx={inputNumberRangeSx}>
          <InputNumber
            dataTestId={`${dataTestId ?? root}From`}
            prefix="От"
            value={value.from}
            onChange={onChangeMin}
            onClear={onClearMin}
            {...props}
          />
          <RangeLine size={size} disabled={disabled} />
          <InputNumber
            dataTestId={`${dataTestId ?? root}To`}
            value={value.to}
            prefix="До"
            onChange={onChangeMax}
            onClear={onClearMax}
            {...props}
          />
        </SxBox>
      </InputTemplate>
    );
  },
);

InputNumberRange.displayName = root;
