import { ReactNode } from 'react';

import { Dictionary } from '@sber-ibp/core';

import {
  FieldValues,
  FormWarningsProps,
  InputAutocompleteFormHandlerProps,
  InputCheckboxFormHandlerProps,
  InputDateFormHandlerProps,
  InputDateRangeFormHandlerProps,
  InputNumberFormHandlerProps,
  InputNumberRangeFormHandlerProps,
  InputTextFormHandlerProps,
  SubmitHandler,
  UseFormReturn,
} from '@/components/molecules/Inputs';
import { GridSizes } from '@/types';

import { InputViewType } from '../../molecules/Inputs/InternalComponents/BaseInput/BaseInput.types';

export type FormConstructorViewType = 'anchors' | 'tab' | 'no-tab' | 'no-tab-headers';

export type CheckboxConstructorProps = { inputType: 'checkbox' } & InputCheckboxFormHandlerProps;
export type TextConstructorProps = { inputType: 'text' } & InputTextFormHandlerProps;
export type NumberConstructorProps = { inputType: 'number' } & InputNumberFormHandlerProps;
export type NumberRangeConstructorProps = { inputType: 'number-range' } & InputNumberRangeFormHandlerProps;
export type DateConstructorProps = { inputType: 'date' } & InputDateFormHandlerProps;
export type DateRangeConstructorProps = { inputType: 'date-range' } & InputDateRangeFormHandlerProps;
export type AutocompleteConstructorProps = {
  inputType: 'autocomplete';
} & Omit<InputAutocompleteFormHandlerProps<any, boolean>, 'options'>;

export type InputFieldProps =
  | CheckboxConstructorProps
  | TextConstructorProps
  | NumberConstructorProps
  | NumberRangeConstructorProps
  | DateConstructorProps
  | DateRangeConstructorProps
  | AutocompleteConstructorProps;

export interface CommonFieldParams<T> {
  name: keyof T;
  sizes: GridSizes;
}

export type AutocompleteField<T> = CommonFieldParams<T> & AutocompleteConstructorProps;

export type FieldParams<T> = CommonFieldParams<T> & InputFieldProps;

export interface FormTabTemplate<T> {
  fieldList: FieldParams<T>[];
  tabKey: string;
  tabName: string;
  disabled?: boolean;
}

export interface FormTemplate<T> {
  forms: FormTabTemplate<T>[];
  maxHeight?: number;
  minHeight?: number;
  viewType: FormConstructorViewType;
  fieldsSpacing?: number;
  fieldsAlignItems?: string;
}

export type FormDictionaryMap<T> = Partial<Record<keyof T, Dictionary[]>>;

export interface FormConstructorProps<FormType extends FieldValues> {
  formTemplate: FormTemplate<FormType>;
  dictionaries: FormDictionaryMap<FormType>;
  formWarnings?: Omit<FormWarningsProps, 'children'>;
  formId: string;
  methods: UseFormReturn<any, object>;
  onSubmit: SubmitHandler<any>;
  fromViewType?: InputViewType;
  headerSection?: ReactNode;
}

export interface FormComponentBaseProps<T> {
  forms: FormTabTemplate<T>[];
  fromViewType?: InputViewType;
  spacing?: number;
  dictionaries: FormDictionaryMap<T>;
  alignItems?: string;
}
