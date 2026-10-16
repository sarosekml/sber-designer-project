import { Dictionary } from '@sber-ibp/core';

import { InputAutocompleteFormHandlerProps } from './InputAutocomplete.handler';

export const getOptionLabel = (option: string) => option;
export const getOptionDictionaryLabel = (option: Dictionary) => option.name;

export const getOptionIdentifier = (option: string) => option;
export const getOptionIdentifierDictionary = (option: Dictionary) => option.code;

export const isOptionEqualToValue = (option1: string, option2: string) => option1 === option2;
export const isOptionEqualToDictionaryValue = (option1: Dictionary, option2: Dictionary) =>
  option1.code === option2.code;

/** Special preset configs for typical using of the autocomplete config - Dictionary value type */
export const singleInputAutocompleteDictionaryProps: Pick<
  InputAutocompleteFormHandlerProps<Dictionary, false>,
  'multiple' | 'getOptionLabel' | 'isOptionEqualToValue' | 'getOptionIdentifier' | 'viewFormat'
> = {
  multiple: false,
  viewFormat: 'text',
  getOptionLabel: getOptionDictionaryLabel,
  getOptionIdentifier: getOptionIdentifierDictionary,
};

export const singleInputAutocompleteBaseProps: Pick<
  InputAutocompleteFormHandlerProps<string, false>,
  'multiple' | 'getOptionLabel' | 'isOptionEqualToValue' | 'getOptionIdentifier' | 'viewFormat'
> = {
  multiple: false,
  viewFormat: 'text',
  getOptionLabel,
  getOptionIdentifier,
};

export const multipleInputAutocompleteDictionaryProps: Pick<
  InputAutocompleteFormHandlerProps<Dictionary, true>,
  'multiple' | 'getOptionLabel' | 'isOptionEqualToValue' | 'getOptionIdentifier' | 'viewFormat'
> = {
  multiple: true,
  viewFormat: 'chip',
  getOptionLabel: getOptionDictionaryLabel,
  getOptionIdentifier: getOptionIdentifierDictionary,
};

export const multipleInputAutocompleteBaseProps: Pick<
  InputAutocompleteFormHandlerProps<string, true>,
  'multiple' | 'getOptionLabel' | 'isOptionEqualToValue' | 'getOptionIdentifier' | 'viewFormat'
> = {
  multiple: true,
  viewFormat: 'chip',
  getOptionLabel,
  getOptionIdentifier,
};

export const multipleInputAutocompleteDictionaryOuterChipProps: Pick<
  InputAutocompleteFormHandlerProps<Dictionary, true>,
  'multiple' | 'getOptionLabel' | 'isOptionEqualToValue' | 'getOptionIdentifier' | 'viewFormat' | 'placeholder'
> = {
  multiple: true,
  viewFormat: 'outerChip',
  getOptionLabel: getOptionDictionaryLabel,
  getOptionIdentifier: getOptionIdentifierDictionary,
};
