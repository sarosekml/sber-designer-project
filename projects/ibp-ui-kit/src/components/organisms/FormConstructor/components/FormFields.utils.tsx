import React from 'react';

import { Dictionary, emptyArray } from '@sber-ibp/core';

import {
  InputAutocompleteFormHandler,
  InputCheckboxFormHandler,
  InputDateFormHandler,
  InputDateRangeFormHandler,
  InputNumberFormHandler,
  InputNumberRangeFormHandler,
  InputTextFormHandler,
} from '@/components/molecules/Inputs';
import { InputViewType } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInput.types';

import { AutocompleteField, FieldParams, FormDictionaryMap } from '../FormConstructor.types';
import { nameToString } from '../FormConstructor.utils';

interface UtilsProps<T> {
  dataTestId?: string;
  viewType?: InputViewType;
  dictionaries: FormDictionaryMap<T>;
}

interface AutocompleteUtilsProps<T> extends UtilsProps<T> {
  field: AutocompleteField<T>;
}

interface OtherUtilsProps<T> extends UtilsProps<T> {
  field: FieldParams<T>;
}

const getInputAutocompleteField = <T,>({ field, dictionaries, viewType, dataTestId }: AutocompleteUtilsProps<T>) => {
  const options =
    dictionaries?.[field.name] && Array.isArray(dictionaries[field.name])
      ? (dictionaries[field.name] as Dictionary[])
      : emptyArray;
  return (
    <InputAutocompleteFormHandler
      {...field}
      viewType={field.viewType ?? viewType}
      options={options}
      dataTestId={dataTestId}
    />
  );
};

export const getNecessaryInput = <T,>({
  field,
  viewType: inputViewType,
  dictionaries,
  dataTestId,
}: OtherUtilsProps<T>) => {
  switch (field.inputType) {
    case 'autocomplete':
      return getInputAutocompleteField({ field, dictionaries, viewType: inputViewType, dataTestId });
    case 'text': {
      const { name, viewType, ...props } = field;
      return (
        <InputTextFormHandler
          {...props}
          name={nameToString(name)}
          viewType={viewType ?? inputViewType}
          dataTestId={dataTestId}
        />
      );
    }
    case 'number': {
      const { name, viewType, ...props } = field;
      return (
        <InputNumberFormHandler
          {...props}
          name={nameToString(name)}
          viewType={viewType ?? inputViewType}
          dataTestId={dataTestId}
        />
      );
    }
    case 'number-range': {
      const { name, viewType, ...props } = field;
      return (
        <InputNumberRangeFormHandler
          {...props}
          name={nameToString(name)}
          viewType={viewType ?? inputViewType}
          dataTestId={dataTestId}
        />
      );
    }
    case 'date': {
      const { name, viewType, ...props } = field;
      return (
        <InputDateFormHandler
          {...props}
          name={nameToString(name)}
          viewType={viewType ?? inputViewType}
          dataTestId={dataTestId}
        />
      );
    }
    case 'date-range': {
      const { name, viewType, ...props } = field;
      return (
        <InputDateRangeFormHandler
          {...props}
          name={nameToString(name)}
          viewType={viewType ?? inputViewType}
          dataTestId={dataTestId}
        />
      );
    }
    case 'checkbox': {
      const { name, viewType, ...props } = field;
      return (
        <InputCheckboxFormHandler
          {...props}
          name={nameToString(name)}
          viewType={viewType ?? inputViewType}
          dataTestId={dataTestId}
        />
      );
    }
    default:
      return null;
  }
};
