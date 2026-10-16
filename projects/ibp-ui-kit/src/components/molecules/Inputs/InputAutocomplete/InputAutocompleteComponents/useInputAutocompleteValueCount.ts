import { useMemo } from 'react';

import { isEmpty } from '@sber-ibp/core';

import { InputAutocompleteProps } from '../InputAutocomplete.types';
import { getStaticValueSortingComparator } from '../InputAutocomplete.utils';

interface InputAutocompleteValueCountProps<T, Multiple extends boolean>
  extends Pick<
    InputAutocompleteProps<T, Multiple>,
    'multiple' | 'isOptionEqualToValue' | 'getOptionLabel' | 'multipleOptions'
  > {
  selectedValues: T[];
  focused: boolean;
}

const emptyArray = [];

export const useInputAutocompleteValueCount = <T, Multiple extends boolean>({
  multipleOptions,
  focused,
  selectedValues,
  isOptionEqualToValue,
  getOptionLabel,
  multiple,
}: InputAutocompleteValueCountProps<T, Multiple>) => {
  if (!multiple)
    return {
      visibleValues: emptyArray,
      hideValuesForTooltip: emptyArray,
      disableCounter: true,
      staticValues: emptyArray,
      visibleItemsCount: 0,
    };

  const staticValues = multipleOptions?.staticValues;
  const visibleItemsCount = multipleOptions?.visibleItemsCount ?? selectedValues.length;
  const disableCounter = !visibleItemsCount || visibleItemsCount === 0 || focused;

  const values = useMemo(() => {
    if (!isEmpty(staticValues) && isOptionEqualToValue) {
      selectedValues.sort(getStaticValueSortingComparator(staticValues as T[], isOptionEqualToValue));
    }
    return {
      visibleValues: disableCounter ? selectedValues : selectedValues.slice(0, visibleItemsCount),
      hideValuesForTooltip: selectedValues.slice(visibleItemsCount).map((value) => getOptionLabel(value)),
    };
  }, [staticValues, visibleItemsCount, disableCounter, selectedValues, isOptionEqualToValue, getOptionLabel]);

  return useMemo(
    () => ({
      visibleValues: values.visibleValues,
      hideValuesForTooltip: values.hideValuesForTooltip,
      disableCounter,
      staticValues,
      visibleItemsCount,
    }),
    [visibleItemsCount, disableCounter, staticValues, values.hideValuesForTooltip, values.visibleValues],
  );
};
