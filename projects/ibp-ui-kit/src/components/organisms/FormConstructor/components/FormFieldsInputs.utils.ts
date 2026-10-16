import { Dictionary } from '@sber-ibp/core';

import {
  multipleInputAutocompleteDictionaryOuterChipProps,
  multipleInputAutocompleteDictionaryProps,
  singleInputAutocompleteDictionaryProps,
} from '@/components/molecules/Inputs/InputAutocomplete';
import { GridSizes, MediumSizeType } from '@/types/common.types';
import { gridSizes } from '@/utils/gridSizes';

import { FieldParams } from '../FormConstructor.types';

interface OptionalMakeObjectProps {
  sizes?: GridSizes;
  size?: MediumSizeType;
}

interface OptionalMakeNumberObjectProps extends OptionalMakeObjectProps {
  multiplier?: number;
}

interface OptionalMakeAutocompleteObjectProps extends OptionalMakeObjectProps {
  getOptionLabel?: (option: Dictionary) => string;
  isOptionEqualToValue?: (o1: Dictionary, o2: Dictionary) => boolean;
  getOptionIdentifier?: (option: Dictionary) => string;
}

export const makeTextObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeObjectProps,
): FieldParams<T> => ({
  inputType: 'text',
  label,
  name,
  size: props?.size ?? 'md',
  sizes: props?.sizes ?? gridSizes(12),
});

export const makeNumberObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeNumberObjectProps,
): FieldParams<T> => ({
  inputType: 'number',
  label,
  name,
  size: props?.size ?? 'md',
  sizes: props?.sizes ?? gridSizes(12),
  multiplier: props?.multiplier,
});

export const makeDateObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeObjectProps,
): FieldParams<T> => ({
  inputType: 'date',
  label,
  name,
  size: props?.size ?? 'md',
  sizes: props?.sizes ?? gridSizes(12),
});

export const makeCheckboxObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeObjectProps,
): FieldParams<T> => ({
  inputType: 'checkbox',
  label,
  name,
  size: props?.size ?? 'md',
  sizes: props?.sizes ?? gridSizes(12),
});

export const makeSingleAutocompleteObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeAutocompleteObjectProps,
): FieldParams<T> => {
  return {
    inputType: 'autocomplete',
    ...singleInputAutocompleteDictionaryProps,
    name,
    label,
    size: props?.size ?? 'md',
    sizes: props?.sizes ?? gridSizes(12),
    getOptionLabel: props?.getOptionLabel
      ? props.getOptionLabel
      : singleInputAutocompleteDictionaryProps.getOptionLabel,
    isOptionEqualToValue: props?.isOptionEqualToValue
      ? props.isOptionEqualToValue
      : singleInputAutocompleteDictionaryProps.isOptionEqualToValue,
  };
};

export const makeMultipleAutocompleteObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeAutocompleteObjectProps,
): FieldParams<T> => {
  return {
    inputType: 'autocomplete',
    ...multipleInputAutocompleteDictionaryProps,
    name,
    label,
    size: props?.size ?? 'md',
    sizes: props?.sizes ?? gridSizes(12),
    getOptionLabel: props?.getOptionLabel
      ? props.getOptionLabel
      : multipleInputAutocompleteDictionaryProps.getOptionLabel,
    isOptionEqualToValue: props?.isOptionEqualToValue
      ? props.isOptionEqualToValue
      : multipleInputAutocompleteDictionaryProps.isOptionEqualToValue,
  };
};

export const makeMultipleAutocompleteOuterChipObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeAutocompleteObjectProps,
): FieldParams<T> => {
  return {
    inputType: 'autocomplete',
    ...multipleInputAutocompleteDictionaryOuterChipProps,
    name,
    label,
    size: props?.size ?? 'md',
    sizes: props?.sizes ?? gridSizes(12),
    getOptionLabel: props?.getOptionLabel
      ? props.getOptionLabel
      : multipleInputAutocompleteDictionaryOuterChipProps.getOptionLabel,
    getOptionIdentifier: props?.getOptionIdentifier
      ? props.getOptionIdentifier
      : multipleInputAutocompleteDictionaryOuterChipProps.getOptionIdentifier,
  };
};

export const makeNumberRangeObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeNumberObjectProps,
): FieldParams<T> => ({
  inputType: 'number-range',
  label,
  name,
  size: props?.size ?? 'md',
  sizes: props?.sizes ?? gridSizes(12),
  multiplier: props?.multiplier,
});

export const makeDateRangeObject = <T>(
  name: keyof T & string,
  label: string,
  props?: OptionalMakeObjectProps,
): FieldParams<T> => ({
  inputType: 'date-range',
  label,
  name,
  size: props?.size ?? 'md',
  sizes: props?.sizes ?? gridSizes(12),
});
