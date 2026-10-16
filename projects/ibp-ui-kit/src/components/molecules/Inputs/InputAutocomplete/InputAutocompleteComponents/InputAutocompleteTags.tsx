import React, { memo, useMemo } from 'react';
import { AutocompleteRenderGetTagProps } from '@mui/material';

import { DictionaryBadge, Grid, ListCounter, prepareArrayForRowView, Text, Tooltip } from '@/components/atoms';

import { InputAutocompleteProps } from '../InputAutocomplete.types';
import { isStaticValue } from '../InputAutocomplete.utils';
import {
  inputAutocompleteChipItemStyles,
  inputAutocompleteCounterStyle,
  InputAutocompleteTooltipText,
} from '../InputAutocompleteStyles/InputAutocompleteTags.styles';

import { useInputAutocompleteValueCount } from './useInputAutocompleteValueCount';

interface InputAutocompleteTagsProps<T, Multiple extends boolean>
  extends Omit<InputAutocompleteProps<T, Multiple>, 'options' | 'optionsGroupBy' | 'onChange' | 'label'> {
  selectedValues: T[];
  getTagProps: AutocompleteRenderGetTagProps;
  focused: boolean;
}

const root = 'InputAutocompleteTags';

const InputAutocompleteTagsComponent = <T, Multiple extends boolean>({
  getOptionLabel,
  selectedValues,
  isOptionEqualToValue,
  getTagProps,
  size,
  dataTestId,
  focused,
  multiple,
  multipleOptions,
  disabled,
  viewFormat,
}: InputAutocompleteTagsProps<T, Multiple>) => {
  if (viewFormat === 'outerChip') {
    if (!multiple || !selectedValues?.length) return null;

    const totalCount = selectedValues.length;
    const tooltipTitle = selectedValues.map((v) => getOptionLabel(v)).join(', ');

    return (
      <Tooltip title={tooltipTitle}>
        <span data-testid={`span_text`}>
          <Text sx={InputAutocompleteTooltipText(size)}>{`Выбрано: ${totalCount}`}</Text>
        </span>
      </Tooltip>
    );
  }

  const { visibleValues, hideValuesForTooltip, disableCounter, staticValues, visibleItemsCount } =
    useInputAutocompleteValueCount<T, Multiple>({
      focused,
      selectedValues,
      isOptionEqualToValue,
      getOptionLabel,
      multiple,
      multipleOptions,
    });
  const counterStyles = useMemo(() => inputAutocompleteCounterStyle(size), [size]);

  const preparedValues = useMemo(() => {
    return visibleValues.map((value, index) => {
      const { onDelete } = getTagProps({ index });
      const label = getOptionLabel(value);
      const preparedDisabled =
        disabled || (isOptionEqualToValue && isStaticValue(value, staticValues, isOptionEqualToValue));
      return (
        <DictionaryBadge
          sx={inputAutocompleteChipItemStyles(viewFormat)}
          size={size}
          key={index}
          component={viewFormat === 'marker' ? 'Marker' : 'Chip'}
          code={label}
          name={label}
          disabled={preparedDisabled}
          dataTestId={root + '_' + dataTestId}
          onDelete={preparedDisabled ? undefined : onDelete}
        />
      );
    });
  }, [
    dataTestId,
    disabled,
    getOptionLabel,
    getTagProps,
    isOptionEqualToValue,
    size,
    staticValues,
    viewFormat,
    visibleValues,
  ]);

  return (
    <>
      {preparedValues}
      {disableCounter ? null : (
        <Grid item>
          <Tooltip title={prepareArrayForRowView(hideValuesForTooltip)}>
            <ListCounter count={selectedValues.length} cutCount={visibleItemsCount} size={size} sx={counterStyles} />
          </Tooltip>
        </Grid>
      )}
    </>
  );
};

InputAutocompleteTagsComponent.displayName = root;
export const InputAutocompleteTags = memo(InputAutocompleteTagsComponent) as typeof InputAutocompleteTagsComponent;
