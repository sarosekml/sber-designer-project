import { useCallback, useEffect, useMemo, useState } from 'react';

import { FormReadyDto } from '@sber-ibp/core';

import { DeepPartial, FieldValues, useForm, useWatch } from '@/components/molecules';
import { useTable } from '@/components/organisms/Tables/utils';

import { getStaticFilters } from '../TableFilters.utils';

import { SetCallback, TableFilterFormDictionaries, TableFilterModalProps } from './TableFilterModal.types';
import { useClearAllFilters } from './useClearAllFilters';
import { useConfigsWithChangeInterceptors } from './useConfigsWithChangeInterceptors';

const useFilterModalVisibleController = () => {
  const [visible, setVisible] = useState(false);

  const openModal = useCallback(() => {
    setVisible(true);
  }, []);
  const closeModal = useCallback(() => {
    setVisible(false);
  }, []);

  return {
    closeModal,
    openModal,
    visible,
  };
};

export const useTableFiltersForm = <Filter extends object, FormType extends FieldValues>({
  formToDto,
  dtoToForm,
  tableCode,
  dictionariesMap,
  emptyFilter = {} as Filter,
  formTemplate: rawFormTemplate,
  filterDictionaries,
  onInputsChanged,
  formProps = {},
  staticFilterKeys,
  onCustomClearFilters,
}: TableFilterModalProps<Filter, FormType>) => {
  const methods = useForm<FormType>(formProps);
  const state = useWatch(methods) as FormReadyDto<FormType>;
  const formTemplate = useConfigsWithChangeInterceptors({
    changeListener: onInputsChanged,
    formTemplate: rawFormTemplate,
    setCallback: methods.setValue as SetCallback<FormType, keyof FormType>,
    state,
  });
  const { visible, openModal, closeModal } = useFilterModalVisibleController();
  const { tableState, controller } = useTable<never, Filter>(tableCode);

  const formDictionaries: TableFilterFormDictionaries<FormType> = useMemo(() => {
    const newMap = filterDictionaries ? filterDictionaries(dictionariesMap, state) : dictionariesMap;
    return Object.keys(newMap).reduce((result, current) => ({ ...result, [current]: newMap[current] }), {});
  }, [dictionariesMap, filterDictionaries, state]);

  /**
   * Here we apply form data to table and close the modal.
   */
  const onSubmit = useCallback(
    (formFiltersData: FormType) => {
      const filters = formToDto(formFiltersData);

      if (staticFilterKeys?.length) {
        const staticFilters = getStaticFilters(staticFilterKeys, tableState?.filters);
        controller.setFilters({ ...filters, ...staticFilters });
        closeModal();
      } else {
        controller.setFilters(filters);
        closeModal();
      }
    },
    [formToDto, staticFilterKeys, tableState?.filters, controller, closeModal],
  );

  const clearAllFilters = useClearAllFilters({ tableCode, emptyFilter, staticFilterKeys, onCustomClearFilters });
  const onClearAll = () => {
    void clearAllFilters();
    closeModal();
  };

  useEffect(() => {
    if (!visible) return;
    const formData = dtoToForm(tableState?.filters, dictionariesMap);
    methods.reset(formData as DeepPartial<FormType>);
  }, [dictionariesMap, dtoToForm, methods, tableState, visible]);

  return {
    closeModal,
    formDictionaries,
    formTemplate,
    methods,
    onClearAll,
    onSubmit,
    openModal,
    visible,
  };
};
