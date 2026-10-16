import React, { useCallback, useMemo } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { Meta, StoryFn } from '@storybook/react';

import { Button, Grid } from '@/components/atoms';
import { Modal } from '@/components/molecules';

import { FormConstructor } from './FormConstructor';
import {
  branchesMock,
  currenciesMock,
  departmentsMock,
  desksMock,
  dictionariesMock,
  FormData,
  formTemplateMock,
  formTemplateUtilsMock,
} from './FormConstructor.mocks';
import { FormConstructorProps, FormDictionaryMap } from '.';

export default {
  title: 'Organisms/FormConstructor',
  component: FormConstructor,
  argTypes: {
    methods: { control: { disable: true }, table: { disable: true } },
    onSubmit: { control: { disable: true }, table: { disable: true } },
  },
} as Meta;

const Template: StoryFn<typeof FormConstructor> = (args) => {
  const methods = useForm<FormData>({
    defaultValues: {
      branch: branchesMock[1],
      desks: [desksMock[1]],
      departments: [departmentsMock[0]],
      currencies: [currenciesMock[1]],
      amount: 1700,
      isActive: false,
      lastUpdate: '2024-03-03',
      price: {
        from: 1500,
        to: 5000,
      },
      project: 'Enigma',
      creationDate: {
        from: '2024-03-03',
        to: '2024-04-04',
      },
    },
  });

  const onSubmit = useCallback(
    () => (formData: FormData) => {
      console.log('form data:', formData);
    },
    [],
  );

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <FormConstructor {...args} methods={methods} onSubmit={onSubmit} />
      </Grid>
      <Grid item xs={12}>
        <Button dataTestId={'DictionarySelectHandlerSubmit'} form={'FormConstructor'} htmlType={'submit'}>
          Submit
        </Button>
      </Grid>
    </Grid>
  );
};

export const AAnchorTemplate = Template.bind({});
AAnchorTemplate.args = {
  formId: 'FormConstructor',
  // TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
  // @ts-ignore description above
  formTemplate: formTemplateMock,
  fromViewType: 'edit',
  // @ts-ignore description above
  dictionaries: dictionariesMock,
};

export const BTabTemplate = Template.bind({});
BTabTemplate.args = {
  formId: 'FormConstructor',
  // @ts-ignore TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
  formTemplate: {
    ...formTemplateMock,
    minHeight: 400,
    maxHeight: 400,
    viewType: 'tab',
  },
  fromViewType: 'edit',
  // @ts-ignore description above
  dictionaries: dictionariesMock,
};

export const CNoTabTemplate = Template.bind({});
CNoTabTemplate.args = {
  formId: 'FormConstructor',
  // @ts-ignore TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
  formTemplate: {
    ...formTemplateMock,
    minHeight: 550,
    maxHeight: 550,
    viewType: 'no-tab',
  },
  fromViewType: 'edit',
  // @ts-ignore description above
  dictionaries: dictionariesMock,
};

/**
 * Example with modal
 * */
const ModalTemplate: StoryFn<typeof FormConstructor> = (args) => {
  const methods = useForm<FormData>();

  const onSubmit = useCallback(
    () => (formData: FormData) => {
      console.log('form data:', formData);
    },
    [],
  );

  return (
    <Modal
      name={'FormConstructorModal'}
      visible={true}
      closeModal={() => console.log('closeModal')}
      height={'450px'}
      width={'650px'}
      title={'Заполнение сделки'}
      contentSx={{ p: 0 }}
      actionsJustify={'flex-end'}
      actions={
        <Button dataTestId={'DictionarySelectHandlerSubmit'} form={'FormConstructorModal'} htmlType={'submit'}>
          Submit
        </Button>
      }
    >
      <FormConstructor {...args} formId={'FormConstructorModal'} methods={methods} onSubmit={onSubmit} />
    </Modal>
  );
};

/**
 * Example no tabs in modal
 * */

export const EModalNoTabs = ModalTemplate.bind({});
EModalNoTabs.args = {
  formId: 'FormConstructorModal',
  formTemplate: {
    // @ts-ignore TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
    forms: [{ ...formTemplateMock.forms[0] }, { ...formTemplateMock.forms[1] }, { ...formTemplateMock.forms[2] }],
    viewType: 'no-tab',
  },
  fromViewType: 'edit',
};

export const FModalAnchor = ModalTemplate.bind({});
FModalAnchor.args = {
  formId: 'FormConstructorModal',
  // @ts-ignore mock has wrong type
  formTemplate: formTemplateMock,
  fromViewType: 'edit',
};

/**
 * Example disabled tabs with modal
 * */

export const GModalAnchorDisabled = ModalTemplate.bind({});

GModalAnchorDisabled.args = {
  formId: 'FormConstructorModal',
  formTemplate: {
    forms: [
      // TS2322: Type '{ disabled: true; fieldList: FieldParams<Nullable<FormFields>>[]; tabKey: string; tabName: string; }'
      // is not assignable to type 'FormTabTemplate<unknown>'.
      //   Types of property 'fieldList' are incompatible.
      // @ts-ignore description above
      { ...formTemplateMock.forms[0] },
      // TS2322: Type '{ disabled: true; fieldList: FieldParams<Nullable<FormFields>>[]; tabKey: string; tabName: string; }'
      // is not assignable to type 'FormTabTemplate<unknown>'.
      //   Types of property 'fieldList' are incompatible.
      // @ts-ignore description above
      { ...formTemplateMock.forms[1] },
      // TS2322: Type '{ disabled: true; fieldList: FieldParams<Nullable<FormFields>>[]; tabKey: string; tabName: string; }'
      // is not assignable to type 'FormTabTemplate<unknown>'.
      //   Types of property 'fieldList' are incompatible.
      // @ts-ignore description above
      { ...formTemplateMock.forms[2], disabled: true },
    ],
    viewType: 'anchors',
  },
  fromViewType: 'edit',
};

/**
 * Example with no tabs shown but with headers on each section of filters
 * */

export const HModalAnchorNoTabs = ModalTemplate.bind({});
HModalAnchorNoTabs.args = {
  formId: 'FormConstructorModal',
  // @ts-ignore mock has wrong type
  formTemplate: { ...formTemplateMock, viewType: 'no-tab-headers' },
  fromViewType: 'edit',
};

/**
 * Example with dependency in dictionaries
 * */
const emptyArray: never[] = [];

const useDependencyDictionaries = (methods: UseFormReturn<FormData, object>): FormDictionaryMap<FormData> => {
  const departmentValues = methods.watch('departments');

  const filteredDesks = useMemo(() => {
    const newDesks =
      !departmentValues || departmentValues.length === 0
        ? desksMock
        : desksMock.filter((it) => departmentValues.map((item) => item.code).includes(it.departmentCode));
    methods.setValue('desks', emptyArray);
    return newDesks;
  }, [departmentValues, methods]);

  return useMemo(
    () => ({
      departments: departmentsMock,
      desks: filteredDesks,
      branch: branchesMock,
      currencies: currenciesMock,
    }),
    [filteredDesks],
  );
};

const TemplateDictionaryDependency: StoryFn<FormConstructorProps<FormData>> = (args) => {
  const methods = useForm<FormData>();
  const dictionaries = useDependencyDictionaries(methods);

  const onSubmit = useCallback(
    () => (formData: FormData) => {
      console.log('form data:', formData);
    },
    [],
  );

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <FormConstructor {...args} methods={methods} onSubmit={onSubmit} dictionaries={dictionaries} />
      </Grid>
      <Grid item xs={12}>
        <Button
          dataTestId={'DictionarySelectHandlerSubmit'}
          form={'FormConstructorDictionaryDependency'}
          htmlType={'submit'}
        >
          Submit
        </Button>
      </Grid>
    </Grid>
  );
};

export const IDictionaryDependencyConstructor = TemplateDictionaryDependency.bind({});
IDictionaryDependencyConstructor.args = {
  formId: 'FormConstructorDictionaryDependency',
  // @ts-ignore TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
  formTemplate: formTemplateMock,
  fromViewType: 'edit',
};

export const JFilterConfigUtils = Template.bind({});
JFilterConfigUtils.args = {
  formId: 'FormConstructor',
  // @ts-ignore TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
  formTemplate: {
    ...formTemplateUtilsMock,
    minHeight: 400,
    maxHeight: 400,
    viewType: 'tab',
  },
  fromViewType: 'edit',
};

export const KNoTabsWithHeaders = Template.bind({});
KNoTabsWithHeaders.args = {
  formId: 'FormConstructor',
  // @ts-ignore TS2322: Type 'FormTemplate<Nullable<FormFields>>' is not assignable to type 'FormTemplate<unknown>'.
  formTemplate: {
    ...formTemplateUtilsMock,
    minHeight: 400,
    maxHeight: 400,
    viewType: 'no-tab-headers',
  },
  fromViewType: 'edit',
};
