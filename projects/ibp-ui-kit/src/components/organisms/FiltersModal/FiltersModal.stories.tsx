import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Meta, StoryFn } from '@storybook/react';

import { Grid } from '@/components/atoms';

import { FiltersChips } from '../FiltersChips';
import { filtersChipsConfig } from '../FiltersChips/FiltersChips.mocks';
import { clearTableFilters } from '../FiltersChips/FiltersChips.utils';
import { FormConstructor } from '../FormConstructor';
import { defaultFilters, dictionariesMock, FormData, formTemplateMock } from '../FormConstructor/FormConstructor.mocks';

import { EditPresetsModal, useEditPresetsModalVisibleController } from './components/EditPresetsModal';
import { FiltersModal } from './FiltersModal';

export default {
  title: 'Organisms/FiltersModal',
  component: FiltersModal,
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
    disabled: { control: 'boolean' },
    fullScreen: { control: 'boolean' },
    enablePresets: { control: 'boolean' },
  },
} as Meta;

const Template: StoryFn<typeof FiltersModal> = (args) => {
  const methods = useForm<FormData>();
  const formId = 'TestFilters';
  const [visible, setVisible] = useState(false);

  const { openModal: openEditPresetsModal } = useEditPresetsModalVisibleController();

  const onOpenModal = useCallback(() => {
    setVisible(true);
  }, []);

  const onCloseModal = useCallback(() => {
    setVisible(false);
  }, []);

  const onSubmit = useCallback(
    () => (filters: FormData) => {
      console.log(filters);
      onCloseModal();
    },
    [onCloseModal],
  );

  const onClear = useCallback(() => {
    methods.reset(defaultFilters);
  }, [methods]);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <FiltersModal
          {...args}
          onOpenModal={onOpenModal}
          closeModal={onCloseModal}
          onClear={onClear}
          formId={formId}
          visible={visible}
          openEditPresetsModal={openEditPresetsModal}
        >
          <FormConstructor
            formId={formId}
            dictionaries={dictionariesMock}
            formTemplate={formTemplateMock}
            methods={methods}
            onSubmit={onSubmit}
          />
        </FiltersModal>
      </Grid>
    </Grid>
  );
};

export const BaseTemplate = Template.bind({});
BaseTemplate.args = {
  width: 800,
  height: 600,
  fullScreen: false,
  disabled: false,
  enablePresets: true,
};

const TemplateComponentWithChips: StoryFn<typeof FiltersModal> = (args) => {
  const methods = useForm<FormData>();
  const formId = 'TestFilters';
  const [visible, setVisible] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);

  const {
    closeModal: closeEditPresetsModal,
    openModal: openEditPresetsModal,
    visible: visibleEditPresetsModal,
  } = useEditPresetsModalVisibleController();

  const onOpenModal = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const onCloseModal = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const onSubmit = useCallback(
    () => (_filters: FormData) => {
      setFilters(_filters);
      onCloseModal();
    },
    [onCloseModal, setFilters],
  );

  const onClear = useCallback(() => {
    methods.reset(defaultFilters);
    setFilters(defaultFilters);
  }, [methods]);

  const onClearFilters = useCallback(
    (filterIds?: (keyof FormData)[]) => {
      if (!filterIds) {
        return setFilters(defaultFilters);
      }

      const newFilters = clearTableFilters(filterIds, filters);
      setFilters(newFilters);
    },
    [filters, setFilters],
  );

  return (
    <Grid container item rowGap={1} alignItems={'center'} sizes={{ xs: 10 }}>
      <FiltersModal
        {...args}
        onOpenModal={onOpenModal}
        closeModal={onCloseModal}
        onClear={onClear}
        formId={formId}
        visible={visible}
        openEditPresetsModal={openEditPresetsModal}
      >
        <FormConstructor
          formId={formId}
          dictionaries={dictionariesMock}
          formTemplate={formTemplateMock}
          methods={methods}
          onSubmit={onSubmit}
        />
      </FiltersModal>
      <FiltersChips onClearFilters={onClearFilters} filtersChipsConfig={filtersChipsConfig} filters={filters} />

      <EditPresetsModal visible={visibleEditPresetsModal} closeModal={closeEditPresetsModal} tableCode={formId} />
    </Grid>
  );
};

export const TemplateWithChips = TemplateComponentWithChips.bind({});
TemplateWithChips.args = {
  width: 800,
  height: 600,
  fullScreen: false,
  disabled: false,
};
