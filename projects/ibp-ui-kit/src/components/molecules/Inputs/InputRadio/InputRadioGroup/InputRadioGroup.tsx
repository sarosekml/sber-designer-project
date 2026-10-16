import React, { memo, useCallback, useMemo } from 'react';
import { RadioGroup } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';
import { Text } from '@/components/atoms/typography/Text';

import { InputRadioButton } from '../InputRadioButton/InputRadioButton';

import {
  getInputRadioGroupListStyles,
  getInputRadioGroupTextStyles,
} from './InputRadioGroupStyles/InputRadioGroup.styles';
import { InputRadioGroupProps } from './InputRadioGroup.types';

const root = 'InputRadioGroup';

export const InputRadioGroup = memo(
  ({
    title,
    name,
    value,
    disabled,
    size = 'md',
    viewType = 'edit',
    orientation = 'vertical',
    dataTestId,
    onChange,
    list,
  }: InputRadioGroupProps) => {
    const textSx = useMemo(() => getInputRadioGroupTextStyles(size), [size]);
    const listSx = useMemo(() => getInputRadioGroupListStyles(size, orientation), [size, orientation]);

    const onChangeHandler = useCallback(
      (_: React.ChangeEvent<HTMLInputElement>, value: string) => {
        onChange && onChange(value);
      },
      [onChange],
    );

    return (
      <SxBox data-testid={dataTestId ? root + '_' + dataTestId : root}>
        {title && (
          <Text dataTestId={dataTestId ? root + '_' + dataTestId : root} sx={textSx}>
            {title}
          </Text>
        )}
        <RadioGroup name={name} value={value} onChange={onChangeHandler} sx={listSx}>
          {list?.map((item, index) => (
            <InputRadioButton
              key={`${dataTestId}_${index}`}
              label={item.label}
              value={item.value}
              helperText={item.helperText}
              dataTestId={dataTestId ? root + '_' + dataTestId : root}
              size={size}
              viewType={viewType}
              disabled={disabled}
            />
          ))}
        </RadioGroup>
      </SxBox>
    );
  },
);

InputRadioGroup.displayName = root;
