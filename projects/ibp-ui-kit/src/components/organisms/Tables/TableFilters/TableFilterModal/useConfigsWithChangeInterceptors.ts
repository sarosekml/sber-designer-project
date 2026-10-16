import { useMemo } from 'react';

import { FormReadyDto } from '@sber-ibp/core';

import { FieldValues } from '@/components/molecules';
import { FormTemplate } from '@/components/organisms/FormConstructor';

import { ChangedField, OnChangeFilterInputCallback, SetCallback } from './TableFilterModal.types';

interface ConfigsWithChangeInterceptorsHookProps<FormType extends FieldValues> {
  changeListener: OnChangeFilterInputCallback<FormType> | undefined;
  formTemplate: FormTemplate<FormType>;
  setCallback: SetCallback<FormType, keyof FormType>;
  state: FormReadyDto<FormType>;
}

export const useConfigsWithChangeInterceptors = <FormType extends FieldValues>({
  formTemplate,
  changeListener,
  state,
  setCallback,
}: ConfigsWithChangeInterceptorsHookProps<FormType>): FormTemplate<FormType> => {
  return useMemo(
    () =>
      changeListener
        ? {
            ...formTemplate,
            forms: formTemplate.forms.map(({ fieldList, ...form }) => ({
              ...form,
              fieldList: fieldList.map((field) => ({
                ...field,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange: (value: any, _e: any) => {
                  field.onChange?.(value as never, _e);
                  changeListener(
                    {
                      name: field.name,
                      value: value,
                    } as ChangedField<FormType, keyof FormType>,
                    setCallback,
                    state,
                  );
                },
              })),
            })),
          }
        : formTemplate,
    [changeListener, formTemplate, setCallback, state],
  );
};
