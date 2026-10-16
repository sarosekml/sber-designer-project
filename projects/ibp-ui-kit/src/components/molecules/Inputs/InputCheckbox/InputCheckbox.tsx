import React, { memo, useCallback, useMemo } from 'react';
import { Checkbox as MuiCheckbox, FormControlLabel } from '@mui/material';

import { SxBox } from '@/components/atoms/SxBox';

import { BaseInputHelperText } from '../InternalComponents/BaseInput/BaseInputComponents/BaseInputHelperText';

import {
  inputCheckboxContainerStyles,
  inputCheckboxHelperTextStyles,
  inputCheckboxLabelStyles,
  inputCheckboxStyles,
} from './InputCheckboxStyles/InputCheckbox.styles';
import { InputCheckboxProps } from './InputCheckbox.types';

const root = 'InputCheckbox';

export const InputCheckbox = memo(
  ({
    label,
    checked,
    onChange,
    disabled,
    name,
    dataTestId,
    helperText,
    indeterminate,
    size = 'md',
    viewType = 'edit',
    id,
    inputRef,
  }: InputCheckboxProps) => {
    const labelSx = useMemo(() => inputCheckboxLabelStyles({ size, disabled, viewType }), [size, disabled, viewType]);
    const checkboxSx = useMemo(
      () => inputCheckboxStyles({ size, viewType, disabled, checked, indeterminate }),
      [disabled, size, viewType, checked, indeterminate],
    );
    const helperTextSx = useMemo(() => inputCheckboxHelperTextStyles(size), [size]);

    const onChangeCallback = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
        onChange?.(checked, event);
      },
      [onChange],
    );

    return (
      <SxBox data-testid={root + '_' + dataTestId} sx={inputCheckboxContainerStyles}>
        <FormControlLabel
          control={
            <MuiCheckbox
              sx={checkboxSx}
              checked={Boolean(checked)}
              name={name}
              onChange={onChangeCallback}
              indeterminate={indeterminate}
              disabled={disabled}
              inputRef={inputRef}
              id={id ?? name}
            />
          }
          sx={labelSx}
          disabled={disabled}
          label={label}
        />
        <SxBox sx={helperTextSx}>
          <BaseInputHelperText helperText={helperText} dataTestId={dataTestId} />
        </SxBox>
      </SxBox>
    );
  },
);

InputCheckbox.displayName = root;
