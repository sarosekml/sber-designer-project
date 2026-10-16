/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormReadyDto } from '@sber-ibp/core';

import { FieldValues, UseFormProps } from '@/components/molecules';
import { LabeledFilters } from '@/components/organisms/FiltersChips';
import { FormTemplate } from '@/components/organisms/FormConstructor';

type NotNullableDictionary<T> = T extends null ? never : T extends any[] ? T : T[];
export type TableFilterFormDictionaries<FormType extends FieldValues> = {
  [P in keyof FormType]?: NotNullableDictionary<FormType[P]>;
};

export type DtoToFormConverter<FilterDto extends object, FormType extends FieldValues> = (
  filters: FilterDto | undefined,
  dictionaries: TableFilterFormDictionaries<FormType>,
) => FormReadyDto<FormType>;

export type FormToDtoConverter<FilterDto extends object, FormType extends FieldValues> = (form: FormType) => FilterDto;

export type DictionaryFilterCallback<FormType extends FieldValues> = (
  dictionaries: TableFilterFormDictionaries<FormType>,
  state: FormReadyDto<FormType>,
) => TableFilterFormDictionaries<FormType>;

export type ChangedField<FormType extends object, FieldName extends keyof FormType> = FieldName extends any
  ? {
      name: FieldName;
      value: FormType[FieldName];
    }
  : never;

export type SetCallback<FormType extends object, FieldName extends keyof FormType> = FormType extends any
  ? (name: FieldName, value: FormType[FieldName]) => void
  : never;

export type OnChangeFilterInputCallback<FormType extends object> = (
  changedField: ChangedField<FormType, keyof FormType>,
  setValue: SetCallback<FormType, keyof FormType>,
  context: FormReadyDto<FormType>,
) => void;

export interface TableFilterModalProps<Filter extends object, FormType extends FieldValues> {
  dictionariesMap: TableFilterFormDictionaries<FormType>;
  dtoToForm: DtoToFormConverter<Filter, FormType>;
  emptyFilter?: Filter;
  enablePresets?: boolean;
  filterDictionaries?: DictionaryFilterCallback<FormType>;
  formTemplate: FormTemplate<FormType>;
  formToDto: FormToDtoConverter<Filter, FormType>;
  onInputsChanged?: OnChangeFilterInputCallback<FormType>;
  tableCode: string;
  formProps?: UseFormProps<FormType>;
  width?: number;
  staticFilterKeys?: (keyof Filter)[];
  onCustomClearFilters?: (filterIds?: (keyof LabeledFilters<Filter>)[]) => void;
  openEditPresetsModal: () => void;
}
