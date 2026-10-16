import React, { memo, useCallback, useMemo } from 'react';
import { FormControlLabel, Switch as MuiSwitch } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';

import { BaseInputHelperText } from '../InternalComponents/BaseInput/BaseInputComponents/BaseInputHelperText';

import {
  inputSwitchContainerStyles,
  inputSwitchHelperTextStyles,
  inputSwitchLabelStyles,
  inputSwitchStyles,
} from './InputSwitchStyles/InputSwitch.styles';
import { InputSwitchProps } from './InputSwitch.types';

const root = 'InputSwitch';

export const InputSwitch = memo(
  ({
    label,
    disabled,
    viewType = 'edit',
    dataTestId,
    checked,
    size = 'md',
    helperText,
    name,
    onChange,
  }: InputSwitchProps) => {
    const labelSx = useMemo(() => inputSwitchLabelStyles({ size, disabled, viewType }), [size, disabled, viewType]);
    const switchSx = useMemo(
      () => inputSwitchStyles({ size, viewType, disabled, checked }),
      [disabled, size, viewType, checked],
    );
    const helperTextSx = useMemo(() => inputSwitchHelperTextStyles(size), [size]);

    const onChangeCallback = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        onChange?.(checked, event);
      },
      [onChange],
    );

    return (
      <SxBox data-testid={root + dataTestId} sx={inputSwitchContainerStyles}>
        <FormControlLabel
          sx={labelSx}
          label={label}
          control={
            <MuiSwitch
              sx={switchSx}
              name={name}
              checked={Boolean(checked)}
              disabled={disabled}
              onChange={onChangeCallback}
            />
          }
        />
        <SxBox sx={helperTextSx}>
          <BaseInputHelperText helperText={helperText} dataTestId={dataTestId} />
        </SxBox>
      </SxBox>
    );
  },
);

InputSwitch.displayName = 'InputSwitch';
