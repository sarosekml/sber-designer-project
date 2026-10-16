import React, { memo, SyntheticEvent, useCallback, useMemo, useRef } from 'react';

import { emptyString } from '@sber-ibp/core';

import { SxBox } from '@/components/atoms';
import { InputCheckbox } from '@/components/molecules/Inputs/InputCheckbox';
import { mergeSx } from '@/utils';

import { checkboxListRowSx, headerCheckboxListRowSx } from './CheckboxListRow.styles';
import { CheckboxListRowProps } from './CheckboxListRow.types';

const root = 'CheckboxListRow';

export const CheckboxListRow = memo(
  ({
    label,
    checked,
    isHeaderRow = false,
    disabled,
    checkboxSize = 'md',
    onChange,
    indeterminate,
    name,
    id,
    dataTestId,
  }: CheckboxListRowProps) => {
    const checkboxRef = useRef<HTMLInputElement>(null);

    const commonGridStyles = useMemo(
      () => (isHeaderRow ? mergeSx(checkboxListRowSx, headerCheckboxListRowSx()) : checkboxListRowSx),
      [isHeaderRow],
    );

    const onChangeInternal = useCallback(
      (ev: SyntheticEvent) => {
        if (checkboxRef.current) {
          ev.preventDefault();
          checkboxRef.current && onChange(checkboxRef.current.id);
        }
      },
      [onChange],
    );

    return (
      <SxBox onClick={!disabled ? onChangeInternal : undefined} columnGap={2} sx={commonGridStyles}>
        <InputCheckbox
          size={checkboxSize}
          checked={checked}
          name={name ?? emptyString}
          label={label}
          disabled={disabled}
          indeterminate={indeterminate}
          inputRef={checkboxRef}
          id={id}
          dataTestId={dataTestId ? root + '_' + dataTestId : root}
        />
      </SxBox>
    );
  },
);

CheckboxListRow.displayName = root;
