import { ChangeEvent, MutableRefObject, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';

import { emptyString, isEqual, useDebouncedCallback } from '@sber-ibp/core';

import { getInputTextDecorator } from '../InputText/InputTextDecorator/InputTextDecorator';
import { useBaseInput } from '../InternalComponents/BaseInput/useBaseInput';

import { useConstructNoOptionsText } from './InputAutocompleteComponents/InputAutocompleteOptionsStates';
import { InputAutocompleteInternalValueType, InputAutocompleteProps, ValueComparator } from './InputAutocomplete.types';
import { completeWithStatics, getOptionsDataByRequest } from './InputAutocomplete.utils';

const textDecorator = getInputTextDecorator({});

const emptyInputValue = '';
const emptyArray = [];

// eslint-disable-next-line sonarjs/cognitive-complexity
export const useInputAutocompleteState = <T, Multiple extends boolean>(props: InputAutocompleteProps<T, Multiple>) => {
  const {
    getOptionLabel,
    getOptionIdentifier = getOptionLabel,
    options,
    asyncOptions,
    onChange,
    autoFocus,
    value,
    multipleOptions,
    multiple,
    onInputChange,
    isOptionEqualToValue: isOptionsEqual,
    updateOnCloseDropdown,
  } = props;

  /**
   * For backward compatibility, this code will not be valid after the isOptionEqualToValue property is deleted
   */
  const isOptionEqualToValue: ValueComparator<T> = useMemo(() => {
    return isOptionsEqual ? isOptionsEqual : (o1, o2) => getOptionIdentifier(o1) === getOptionIdentifier(o2);
  }, [getOptionIdentifier, isOptionsEqual]);

  const staticValues = multipleOptions?.staticValues;
  const emptyValue = useMemo(
    () => (multiple ? staticValues ?? emptyArray : null) as InputAutocompleteInternalValueType<T, Multiple>,
    [multiple, staticValues],
  );

  const [isSelectedAll, setSelectedAll] = useState(false);
  const [internalOptions, setInternalOptions] = useState<T[]>(asyncOptions ? emptyArray : options ?? emptyArray);
  const [isError, setIsError] = useState<boolean>(false);
  const [isResponded, setIsResponded] = useState<boolean>(false);
  const noOptionsText = useConstructNoOptionsText({ options: internalOptions, isError, isResponded, asyncOptions });
  const [selectedValue, setSelectedValue] = useState(
    completeWithStatics(value, emptyValue, multiple, isOptionEqualToValue, multipleOptions),
  );
  /**
   * The empty value should be defined by default,
   * because the initial value makes input to work
   * in controlled mode, otherwise it is
   * uncontrolled and ignores the value
   */
  const [inputText, setInputText] = useState<string>(emptyInputValue);
  const [isOpened, setIsOpened] = useState(false);
  const [postfixRef, setPostfixRef] = useState<MutableRefObject<HTMLDivElement | null>>();

  const { focused, hovered, onFocus, onMouseEnter, onMouseLeave, ...baseInput } = useBaseInput({ autoFocus });

  useEffect(() => {
    if (asyncOptions || !options || isEqual(options, internalOptions)) return;
    setInternalOptions(options);
  }, [options, internalOptions, asyncOptions]);

  const filteredInternalOptions = useMemo(() => {
    return Array.from(new Map(internalOptions.map((option) => [getOptionIdentifier(option), option])).values());
  }, [getOptionIdentifier, internalOptions]);

  useEffect(() => {
    multiple && setSelectedAll(options?.every((element) => (selectedValue as T[]).includes(element)) ?? false);
  }, [multiple, options, selectedValue]);

  useEffect(() => {
    const finalValue = completeWithStatics(value, emptyValue, multiple, isOptionEqualToValue, multipleOptions);
    setSelectedValue(finalValue);
  }, [emptyValue, isOptionEqualToValue, multiple, multipleOptions, value]);

  const onChangeCallback = useCallback(
    (_event, newValue: InputAutocompleteInternalValueType<T, Multiple>) => {
      const enriched = completeWithStatics(newValue, emptyValue, multiple, isOptionEqualToValue, multipleOptions);
      setSelectedValue(enriched);
      if (!updateOnCloseDropdown) onChange?.(enriched);
    },
    [emptyValue, multiple, isOptionEqualToValue, multipleOptions, onChange, updateOnCloseDropdown],
  );

  const onBlur = useCallback(() => {
    if (updateOnCloseDropdown) onChange?.(selectedValue);
    baseInput.onBlur();
  }, [baseInput, onChange, selectedValue, updateOnCloseDropdown]);

  const onInputChangeCallback = useCallback(
    (event: React.SyntheticEvent, newInputValue?: string) => {
      const newValue = textDecorator.rawValueToDecorated(newInputValue) ?? emptyString;
      const newEvent = {
        ...(event ?? {}),
        target: {
          ...(event?.target ?? {}),
          value: newValue,
        },
      } as Partial<ChangeEvent<HTMLInputElement | HTMLTextAreaElement>>;
      setInputText(newValue);
      onInputChange?.(newEvent, newValue);
    },
    [onInputChange],
  );

  const onKeyUpCallback = useDebouncedCallback(
    (event) => {
      const value = event.target.value;
      getOptionsDataByRequest({ value, setInternalOptions, setIsError, setIsResponded, asyncOptions });
    },
    [asyncOptions],
    asyncOptions?.userInputDelay ?? 500,
  );

  const onOpenCallback = useCallback(() => {
    setIsOpened(true);
  }, []);

  const onCloseCallback = useCallback(() => {
    setIsOpened(false);
  }, []);

  const onSelectAllCallback = useCallback(() => {
    setIsOpened(false);
    setSelectedValue(options as SetStateAction<(Multiple extends true ? T[] : T) | null>);
    if (!updateOnCloseDropdown) onChange?.(options as InputAutocompleteInternalValueType<T, Multiple>);
  }, [onChange, options, updateOnCloseDropdown]);

  const onClearCallback = useCallback(() => {
    setIsOpened(false);
    setSelectedValue(emptyValue);
    setInputText(emptyInputValue);
    if (!updateOnCloseDropdown) onChange?.(emptyValue);
  }, [emptyValue, onChange, updateOnCloseDropdown]);

  const getPostfixRefCallback = useCallback(
    (postfixRef: MutableRefObject<HTMLDivElement | null>) => {
      setPostfixRef(postfixRef);
    },
    [setPostfixRef],
  );

  const getOptionDisabledCallback = useCallback(
    (option: T) => Boolean(multipleOptions?.staticValues?.find((it) => isEqual(it, option))),
    [multipleOptions?.staticValues],
  );

  return useMemo(
    () => ({
      getOptionIdentifier,
      isOptionEqualToValue,
      noOptionsText,
      isOpened,
      isSelectedAll,
      onChangeCallback,
      onKeyUpCallback,
      onOpenCallback,
      onCloseCallback,
      onClearCallback,
      onSelectAllCallback,
      internalOptions: filteredInternalOptions,
      selectedValue,
      focused,
      hovered,
      inputText,
      onBlur,
      onFocus,
      onMouseEnter,
      onMouseLeave,
      getPostfixRefCallback,
      postfixRef,
      onInputChangeCallback,
      getOptionDisabledCallback,
    }),
    [
      inputText,
      getOptionIdentifier,
      isOptionEqualToValue,
      noOptionsText,
      isOpened,
      isSelectedAll,
      onChangeCallback,
      onKeyUpCallback,
      onOpenCallback,
      onCloseCallback,
      onClearCallback,
      onSelectAllCallback,
      filteredInternalOptions,
      selectedValue,
      focused,
      hovered,
      onBlur,
      onFocus,
      onMouseEnter,
      onMouseLeave,
      getPostfixRefCallback,
      postfixRef,
      onInputChangeCallback,
      getOptionDisabledCallback,
    ],
  );
};
