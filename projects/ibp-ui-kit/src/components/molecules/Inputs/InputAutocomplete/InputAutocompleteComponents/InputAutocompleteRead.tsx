import React, { memo, useMemo } from 'react';

import { dashSymbol, isEmpty } from '@sber-ibp/core';

import { DictionaryBadge, Grid, ListCounter, prepareArrayForRowView, SxBox, Tooltip } from '@/components/atoms';

import { BaseInput } from '../../InternalComponents/BaseInput/BaseInput';
import { TooltipErrorOptionsProps } from '../../InternalComponents/BaseInput/BaseInput.utils';
import { BaseInputHelperText } from '../../InternalComponents/BaseInput/BaseInputComponents/BaseInputHelperText';
import { BaseInputLabel } from '../../InternalComponents/BaseInput/BaseInputComponents/BaseInputLabel';
import { InputAutocompleteInternalValueType, InputAutocompleteProps } from '../InputAutocomplete.types';
import { isStaticValue } from '../InputAutocomplete.utils';
import { inputAutocompleteReadStyles } from '../InputAutocompleteStyles/InputAutocompleteRead.styles';
import { inputAutocompleteCounterStyle } from '../InputAutocompleteStyles/InputAutocompleteTags.styles';

import { useInputAutocompleteValueCount } from './useInputAutocompleteValueCount';

const root = 'InputAutocompleteRead';

interface InputAutocompleteReadProps<T, Multiple extends boolean>
  extends Omit<InputAutocompleteProps<T, Multiple>, 'value'> {
  focused: boolean;
  tooltipErrorOptions: TooltipErrorOptionsProps;
  selectedValue: InputAutocompleteInternalValueType<T, Multiple>;
}

const InputAutocompleteReadComponent = <T, Multiple extends boolean>(
  props: InputAutocompleteReadProps<T, Multiple>,
) => {
  const {
    label,
    labelOptions,
    disabled,
    size,
    prefix,
    postfix,
    dataTestId,
    helperText,
    validationOptions,
    getOptionLabel,
    isOptionEqualToValue,
    focused,
    tooltipErrorOptions,
    multiple,
    multipleOptions,
    selectedValue,
    viewType,
    viewFormat,
  } = props;

  if (!multiple) {
    return (
      <BaseInput
        value={isEmpty(selectedValue) ? '' : getOptionLabel(selectedValue as T)}
        label={label}
        labelOptions={labelOptions}
        disabled={disabled}
        size={size}
        prefix={prefix}
        postfix={postfix}
        helperText={helperText}
        viewType={viewType}
        dataTestId={dataTestId}
        validationOptions={validationOptions}
      />
    );
  }

  if (multiple && selectedValue) {
    const counterStyles = useMemo(() => inputAutocompleteCounterStyle(size), [size]);
    const { itemsContainer, itemIndents } = useMemo(() => inputAutocompleteReadStyles(), []);
    const selectedValues = selectedValue as T[];
    const { visibleValues, hideValuesForTooltip, disableCounter, staticValues, visibleItemsCount } =
      useInputAutocompleteValueCount({
        focused,
        selectedValues,
        isOptionEqualToValue,
        getOptionLabel,
        multiple,
        multipleOptions,
      });

    const valueView = useMemo(() => {
      return visibleValues.map((it, index) => {
        const disabledStaticValues = isOptionEqualToValue && isStaticValue(it, staticValues, isOptionEqualToValue);
        const label = getOptionLabel(it);
        return (
          <DictionaryBadge
            sx={itemIndents}
            size={size}
            key={index}
            component={viewFormat === 'marker' ? 'Marker' : 'Chip'}
            name={label}
            code={label}
            disabled={disabledStaticValues}
            dataTestId={dataTestId}
          />
        );
      });
    }, [dataTestId, getOptionLabel, isOptionEqualToValue, itemIndents, size, staticValues, viewFormat, visibleValues]);

    return (
      <Tooltip {...tooltipErrorOptions}>
        <SxBox>
          <BaseInputLabel label={label} labelOptions={labelOptions} dataTestId={dataTestId} disabled={disabled} />
          <SxBox sx={itemsContainer}>
            {valueView}
            {disableCounter ? null : (
              <Grid item>
                <Tooltip title={prepareArrayForRowView(hideValuesForTooltip)}>
                  <ListCounter
                    count={selectedValues.length}
                    cutCount={visibleItemsCount}
                    size={size}
                    sx={counterStyles}
                  />
                </Tooltip>
              </Grid>
            )}
          </SxBox>
          <BaseInputHelperText helperText={helperText} dataTestId={dataTestId} />
        </SxBox>
      </Tooltip>
    );
  }

  return null;
};

InputAutocompleteReadComponent.displayName = root;
export const InputAutocompleteRead = memo(InputAutocompleteReadComponent) as typeof InputAutocompleteReadComponent;
