import React, { memo } from 'react';

import { FieldValues } from '@/components/molecules';
import { FiltersModal } from '@/components/organisms/FiltersModal';
import { FiltersModalFormConstructor } from '@/components/organisms/FiltersModal/components/FiltersModalFormConstructor';

import { TableFilterModalProps } from './TableFilterModal.types';
import { useTableFiltersForm } from './useTableFiltersForm';

export const TableFilterModalComponent = <Filter extends object, FormType extends FieldValues>(
  props: TableFilterModalProps<Filter, FormType>,
) => {
  const { closeModal, onClearAll, methods, openModal, onSubmit, visible, formTemplate, formDictionaries } =
    useTableFiltersForm(props);

  return (
    <FiltersModal<Filter, FormType>
      onOpenModal={openModal}
      closeModal={closeModal}
      onClear={onClearAll}
      formId={props.tableCode}
      visible={visible}
      width={props.width ?? 800}
      enablePresets={props.enablePresets}
      staticFilterKeys={props.staticFilterKeys}
      filterFormMethods={methods}
      formToDto={props.formToDto}
      openEditPresetsModal={props.openEditPresetsModal}
    >
      <FiltersModalFormConstructor
        formId={props.tableCode}
        dictionaries={formDictionaries}
        formTemplate={formTemplate}
        methods={methods}
        onSubmit={onSubmit}
        dtoToForm={props.dtoToForm}
        dictionariesMap={props.dictionariesMap}
        formToDto={props.formToDto}
        openEditPresetsModal={props.openEditPresetsModal}
        enablePresets={props.enablePresets}
      />
    </FiltersModal>
  );
};

export const TableFilterModal = memo(TableFilterModalComponent) as typeof TableFilterModalComponent & {
  displayName: string;
};
TableFilterModal.displayName = 'TableFilterModal';
