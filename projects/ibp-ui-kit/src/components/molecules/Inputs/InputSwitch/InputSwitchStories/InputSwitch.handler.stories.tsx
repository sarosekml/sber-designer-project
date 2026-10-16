import React, { useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputSwitchFormHandler } from '../InputSwitch.handler';

const meta: Meta<typeof InputSwitchFormHandler> = {
  title: 'Molecules/Inputs/InputSwitch/InputSwitchFormHandler',
  component: InputSwitchFormHandler,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
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
  },
};

export default meta;
type Story = StoryObj<typeof InputSwitchFormHandler>;

interface FormData {
  check: boolean | null;
}

const InputSwitchFormHandlerTemplate = (args) => {
  const methods = useForm<FormData>();

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputSwitch'} onSubmit={onSubmit}>
          <InputSwitchFormHandler {...args} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputSwitch">Submit</SubmitButton>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputSwitchFormHandler',
      },
    },
  },
  args: {
    label: 'Text',
    name: 'check',
    disabled: false,
    helperText: 'Helper text',
    size: 'md',
    viewType: undefined,
    onChange: action('onChange'),
  },
  render: (args) => <InputSwitchFormHandlerTemplate {...args} />,
};
