import React, { memo, useCallback, useMemo } from 'react';
import { FormControlLabel, Radio as MuiRadio } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';
import { BaseInputHelperText } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInputComponents/BaseInputHelperText';

import {
  getInputRadioButtonHelpertextStyles,
  getInputRadioButtonLabelStyles,
  getInputRadioButtonStyles,
} from './InputRadioButtonStyles/InputRadioButton.styles';
import { InputRadioButtonProps } from './InputRadioButton.types';

const root = 'InputRadioButton';

export const InputRadioButton = memo(
  ({
    value,
    label = '',
    onChange,
    disabled,
    name,
    dataTestId,
    helperText,
    size = 'md',
    viewType = 'edit',
    id,
    inputRef,
  }: InputRadioButtonProps) => {
    const radioButtonSx = useMemo(
      () => getInputRadioButtonStyles({ size, viewType, disabled }),
      [size, viewType, disabled],
    );
    const labelSx = useMemo(() => getInputRadioButtonLabelStyles(size, viewType, disabled), [size, viewType, disabled]);
    const helperTextSx = useMemo(() => getInputRadioButtonHelpertextStyles(size), [size]);

    const onChangeCallback = useCallback(
      (_: React.ChangeEvent<HTMLInputElement>) => {
        onChange && onChange();
      },
      [onChange],
    );

    return (
      <SxBox data-testid={root + dataTestId}>
        <FormControlLabel
          value={value}
          label={label}
          disabled={disabled}
          sx={labelSx}
          control={
            <MuiRadio
              name={name}
              onChange={onChangeCallback}
              disabled={disabled}
              sx={radioButtonSx}
              id={id}
              inputRef={inputRef}
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

InputRadioButton.displayName = root;
