import React, { memo, useCallback, useState } from 'react';

import { SxBox } from '@/components/atoms/SxBox';
import { Sx } from '@/utils';

import { InputDate } from '../../InputDate/InputDate';
import { InputTemplate } from '../../InputTemplate';
import { RangeLine } from '../../InternalComponents/RangeLine/RangeLine';
import { InputDateRangeProps } from '../InputRange.types';

const root = 'InputDateRange';

const inputDateRangeSx: Sx = { display: 'flex', alignItems: 'center', gap: 1, width: '100%' };

export const InputDateRange = memo(
  ({
    dataTestId,
    helperText,
    size,
    disabled,
    label,
    labelOptions,
    value,
    onClear,
    onChange,
    ...props
  }: InputDateRangeProps) => {
    const [valueFrom, setValueFrom] = useState(value.from);
    const [valueTo, setValueTo] = useState(value.to);
    const [viewValueFrom, setViewValueFrom] = useState(value.from);
    const [viewValueTo, setViewValueTo] = useState(value.to);

    const onChangeMin = useCallback(
      (date, viewValue) => {
        setValueFrom(date);
        setViewValueFrom(viewValue);
        onChange?.({ from: date, to: valueTo, viewValueFrom: viewValue, viewValueTo });
      },
      [onChange, valueTo, viewValueTo],
    );

    const onChangeMax = useCallback(
      (date, viewValue) => {
        setValueTo(date);
        setViewValueTo(viewValue);
        onChange?.({ from: valueFrom, to: date, viewValueFrom, viewValueTo: viewValue });
      },
      [onChange, valueFrom, viewValueFrom],
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
        <SxBox sx={inputDateRangeSx}>
          <InputDate
            dataTestId={`${dataTestId ?? root}From`}
            prefix="От"
            value={value.from}
            onChange={onChangeMin}
            onClear={onClearMin}
            {...props}
          />
          <RangeLine size={size} disabled={disabled} />
          <InputDate
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

InputDateRange.displayName = root;
