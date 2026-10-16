import React, { useCallback } from 'react';
import { yupResolver } from '@hookform/resolvers/yup/dist/yup.js';

import { emptyArray, FilterPreset, i18n, uuid } from '@sber-ibp/core';

import { Button, SubmitButton } from '@/components/atoms';
import {
  FieldValues,
  FormHandler,
  InputTextFormHandler,
  Modal,
  ModalProps,
  useForm,
  UseFormReturn,
} from '@/components/molecules';
import { FormToDtoConverter } from '@/components/organisms/Tables';
import { useFilterPresets } from '@/components/organisms/Tables/TableFilters/FilterPresets.context';
import { presetValidationSchema } from '@/utils';

export interface SavePresetModalProps<Filter extends object, FormType extends FieldValues>
  extends Pick<ModalProps, 'closeModal' | 'visible'> {
  filterFormMethods: UseFormReturn<any, object>;
  formToDto: FormToDtoConverter<Filter, FormType>;
}

const root = 'SavePresetModal';
const formId = 'SavePresetForm';

export const SavePresetModal = <Filter extends object, FormType extends FieldValues>({
  closeModal,
  filterFormMethods,
  formToDto,
  visible,
}: SavePresetModalProps<Filter, FormType>) => {
  const { presets, storePresets } = useFilterPresets();

  const methods = useForm<Pick<FilterPreset<Filter>, 'name'>>({
    defaultValues: { name: undefined },
    resolver: yupResolver(presetValidationSchema(presets)()),
    shouldUnregister: true,
  });

  const onSubmit = useCallback(() => {
    const currentFilters = formToDto(filterFormMethods.getValues());
    const currentFiltersNotNull = Object.fromEntries(
      Object.entries(currentFilters).filter(([, value]) => value !== null),
    ) as Filter;

    const resetFilterPresets = presets?.map((item) => ({ ...item, active: false })) ?? emptyArray;

    void storePresets([
      ...resetFilterPresets,
      {
        filters: currentFiltersNotNull,
        name: methods.getValues('name'),
        objectId: uuid(),
        active: false,
      },
    ]);

    closeModal?.();
  }, [closeModal, filterFormMethods, formToDto, methods, presets, storePresets]);

  const actions: React.ReactNode = (
    <>
      <Button dataTestId={`${root}_CancelButton`} type={'transparent'} onClick={closeModal}>
        {i18n.t<string>('Cancel')}
      </Button>
      <SubmitButton formId={formId} label={i18n.t<string>('Save')} />
    </>
  );

  return (
    <Modal
      title={i18n.t<string>('Save preset')}
      name={root}
      closeModal={closeModal}
      visible={visible}
      height={236}
      actions={actions}
      width={700}
      useTopPadding
    >
      <FormHandler formId={formId} dataTestId={root} methods={methods} onSubmit={onSubmit}>
        <InputTextFormHandler dataTestId={`${formId}_name`} label={i18n.t('Name')} name={'name'} />
      </FormHandler>
    </Modal>
  );
};
