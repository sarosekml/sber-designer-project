import React, { memo, useEffect, useState } from 'react';

import { emptyArray, FilterPreset, isEqual } from '@sber-ibp/core';

import { FieldValues } from '@/components/molecules';
import { InputAutocompleteInternalValueType } from '@/components/molecules/Inputs/InputAutocomplete/InputAutocomplete.types';
import { FormConstructor } from '@/components/organisms/FormConstructor';
import { useFilterPresets } from '@/components/organisms/Tables/TableFilters/FilterPresets.context';

import { PresetsSection } from './components/PresetsSection';
import { FiltersModalFormConstructorProps } from './FiltersModalFormConstructor.types';

const root = 'FiltersModalFormConstructorRoot';

export const FiltersModalFormConstructorComponent = <Filter extends object, FormType extends FieldValues>({
  dtoToForm,
  dictionariesMap,
  formToDto,
  openEditPresetsModal,
  enablePresets,
  ...props
}: FiltersModalFormConstructorProps<Filter, FormType>) => {
  const { formTemplate, methods, onSubmit } = props;
  const { fieldsSpacing } = formTemplate;

  const watchedFields = methods.watch();

  const { presets: filterPresets, storePresets } = useFilterPresets();
  const presets = filterPresets as FilterPreset<Filter>[] | undefined;
  const [currentPreset, setCurrentPreset] = useState<FilterPreset<Filter> | null>(
    () => presets?.find((item) => item.active) ?? null,
  );

  const onChangeCurrentPreset = (value: InputAutocompleteInternalValueType<FilterPreset<Filter>, false> | null) => {
    if (!presets) return;
    const preset = presets?.find((item) => item.name === value?.name) ?? null;

    if (!preset || !preset?.filters) return;

    setCurrentPreset(preset);
    methods.reset(dtoToForm(preset.filters, dictionariesMap));
  };

  useEffect(() => {
    if (!isEqual(currentPreset?.filters, formToDto(watchedFields))) setCurrentPreset(null);
  }, [currentPreset, formToDto, watchedFields]);

  useEffect(() => {
    return setCurrentPreset(presets?.find((item) => item.active) ?? null);
  }, [presets]);

  const handleSubmit = (formFiltersData: FormType) => {
    if (currentPreset)
      void storePresets(
        presets?.map((item) =>
          item.objectId === currentPreset.objectId ? { ...item, active: true } : { ...item, active: false },
        ) ?? emptyArray,
      );

    onSubmit(formFiltersData);
  };

  return (
    <FormConstructor
      {...props}
      onSubmit={handleSubmit}
      headerSection={
        enablePresets ? (
          <PresetsSection
            dataTestId={root}
            fieldsSpacing={fieldsSpacing}
            onChangeCurrentPreset={onChangeCurrentPreset}
            openEditPresetsModal={openEditPresetsModal}
            preset={currentPreset}
            presetOptions={presets}
          />
        ) : null
      }
    />
  );
};

const FiltersModalFormConstructorUntyped = memo(FiltersModalFormConstructorComponent);
FiltersModalFormConstructorUntyped.displayName = 'FiltersModalFormConstructor';

export const FiltersModalFormConstructor =
  FiltersModalFormConstructorUntyped as typeof FiltersModalFormConstructorComponent;
