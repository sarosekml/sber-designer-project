import {
  InputAutocompleteInternalValueType,
  InputAutocompleteMultipleOptions,
  OptionsDataByRequestProps,
  ValueComparator,
} from './InputAutocomplete.types';

export const isStaticValue = <T>(option: T, staticValues: T[] | undefined, isEqual: ValueComparator<T>) => {
  return staticValues?.some((staticVal) => isEqual(staticVal, option));
};

// Move static values to the beginning of the values array
export const getStaticValueSortingComparator =
  <T>(disabledOptions: T[], valueComparator: ValueComparator<T>) =>
    (option1: T, option2: T) =>
      (isStaticValue(option2, disabledOptions, valueComparator) ? 1 : 0) -
      (isStaticValue(option1, disabledOptions, valueComparator) ? 1 : 0);

export const getOptionsDataByRequest = <T>({
  value,
  setInternalOptions,
  setIsError,
  setIsResponded,
  asyncOptions,
}: OptionsDataByRequestProps<T>) => {
  if (!asyncOptions) return;
  setIsResponded(false);
  if (value && value.length >= (asyncOptions?.minSearchCount ?? 3)) {
    void asyncOptions
      .loadData(value)
      .then((response) => {
        if (response) {
          setInternalOptions(response);
          setIsError(false);
          setIsResponded(true);
        }
      })
      .catch(() => {
        setIsError(true);
        setIsResponded(false);
      });
  }
};

export const completeWithStatics = <T, Multiple extends boolean>(
  value: InputAutocompleteInternalValueType<T, Multiple>,
  emptyValue: InputAutocompleteInternalValueType<T, Multiple>,
  multiple: Multiple | undefined,
  isOptionEqualToValue: ValueComparator<T>,
  multipleOptions?: Multiple extends true ? InputAutocompleteMultipleOptions<T> : never,
) => {
  let result: InputAutocompleteInternalValueType<T, Multiple> = value ?? emptyValue;
  const staticValues = multipleOptions?.staticValues;
  if (multiple && staticValues && value) {
    const valArr = value as T[];
    const noStaticArr = valArr?.filter((it) => staticValues.every((stIt) => !isOptionEqualToValue(it, stIt)));
    result = [...staticValues, ...noStaticArr] as InputAutocompleteInternalValueType<T, Multiple>;
  }
  return result ?? emptyValue;
};
