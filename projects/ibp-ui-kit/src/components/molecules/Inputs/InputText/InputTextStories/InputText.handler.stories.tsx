import React, { useCallback, useEffect } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputTextFormHandler } from '../InputText.handler';

const meta: Meta<typeof InputTextFormHandler> = {
  title: 'Molecules/Inputs/InputText/InputTextFormHandler',
  component: InputTextFormHandler,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    multiline: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
      control: { type: 'radio' },
    },
    label: { control: 'text' },
    helperText: { control: 'text' },
    name: { control: 'text' },
    textColor: { control: 'text' },
    minRows: { control: 'number' },
    maxRows: { control: 'number' },
    maxLength: { control: 'number' },
    rows: { control: 'number' },
    placeholder: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof InputTextFormHandler>;

interface FormData {
  text: string | null;
}

const InputTextHandlerTemplate = (args) => {
  const methods = useForm<FormData>({
    defaultValues: {
      text: 'Test text for testing text',
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('We called new set!!');
      methods.setValue('text', 'Обновление из вне, ререндер должен случиться!');
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const onClear = useCallback(() => {
    methods.setValue('text', null);
  }, [methods]);

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputText'} onSubmit={onSubmit} viewType={'read'}>
          <InputTextFormHandler {...args} onClear={onClear} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputText">Submit</SubmitButton>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputText',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    label: 'Любая строка',
    name: 'text',
    disabled: false,
    helperText: 'Работаем со строкой',
    infoOptions: {
      tooltipValue: 'Информация о строке',
    },
    isColoredBg: false,
    labelOptions: {
      tooltipValue: 'Описание смысла этого поля ввода',
    },
    multiline: false,
    postfix: '###',
    prefix: '№№№',
    size: 'md',
    viewType: 'edit',
    rows: 1,
    startAction: undefined,
    validationOptions: undefined,
    minRows: 0,
    maxRows: 0,
    placeholder: 'placeholder text',
    onClear: action('onClear'),
    onInfo: action('onInfo'),
    onChange: action('onChange'),
    onKeyDown: action('onKeyDown'),
  },
  render: (args) => <InputTextHandlerTemplate {...args} />,
};
