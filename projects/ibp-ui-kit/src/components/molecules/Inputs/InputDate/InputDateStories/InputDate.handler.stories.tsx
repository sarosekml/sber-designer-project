import React, { useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputDateFormHandler } from '../InputDate.handler';

const meta: Meta<typeof InputDateFormHandler> = {
  title: 'Molecules/Inputs/InputDate/InputDateFormHandler',
  component: InputDateFormHandler,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    locale: {
      options: [undefined, 'ru', 'en'],
      control: { type: 'radio' },
    },
    view: {
      options: [undefined, 'month', 'year'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
      control: { type: 'radio' },
    },
    label: { control: 'text' },
    helperText: { control: 'text' },
    placeholder: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof InputDateFormHandler>;
interface FormData {
  date: string | null;
}

const InputDateHandlerTemplate = (args) => {
  const methods = useForm<FormData>();

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputDateFormHandler'} onSubmit={onSubmit}>
          <InputDateFormHandler {...args} />
          <InputDateFormHandler {...args} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputDateFormHandler">Submit</SubmitButton>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  args: {
    label: 'Любая строка',
    name: 'date',
    disabled: false,
    helperText: 'helperText',
    infoOptions: {
      tooltipValue: 'tooltipValue',
    },
    isColoredBg: false,
    size: 'md',
    viewType: 'edit',
    onClear: action('onClear'),
    onChange: action('onChange'),
    onInfo: action('onInfo'),
  },
  render: (args) => <InputDateHandlerTemplate {...args} />,
};
