import React, { useCallback, useEffect } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid, SubmitButton } from '@/components/atoms';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputCheckboxFormHandler } from '../InputCheckbox.handler';

const meta: Meta<typeof InputCheckboxFormHandler> = {
  title: 'Molecules/Inputs/InputCheckbox/InputCheckboxFormHandler',
  component: InputCheckboxFormHandler,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
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
    id: { control: 'text' },
    name: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof InputCheckboxFormHandler>;

interface FormData {
  check: boolean | null;
}

const InputCheckboxHandlerTemplate = (args) => {
  const methods = useForm<FormData>();

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('We called new set!!');
      methods.setValue('check', true);
    }, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputCheckbox'} onSubmit={onSubmit}>
          <InputCheckboxFormHandler {...args} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputCheckbox">Submit</SubmitButton>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputCheckboxFormHandler',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    label: 'Text',
    name: 'check',
    disabled: false,
    helperText: 'Helper text',
    size: 'md',
    viewType: undefined,
    indeterminate: false,
    id: '12345',
    onChange: action('onChange'),
  },
  render: (args) => <InputCheckboxHandlerTemplate {...args} />,
};
