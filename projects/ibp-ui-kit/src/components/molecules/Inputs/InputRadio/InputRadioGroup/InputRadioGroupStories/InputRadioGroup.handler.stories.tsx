import React, { useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputRadioGroupFormHandler } from '../InputRadioGroup.handler';

const meta: Meta<typeof InputRadioGroupFormHandler> = {
  title: 'Molecules/Inputs/InputRadioButton/InputRadioGroup/InputRadioGroupFormHandler',
  component: InputRadioGroupFormHandler,
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
    orientation: {
      options: ['vertical', 'horizontal'],
      control: { type: 'radio' },
    },
    title: { control: 'text' },
    name: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof InputRadioGroupFormHandler>;

interface FormData {
  radioGroup: string | null;
}

const InputRadioGroupFormHandlerTemplate = (args) => {
  const methods = useForm<FormData>({
    defaultValues: {
      radioGroup: 'radioButtonValue3',
    },
  });

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputRadioGroupFormHandler'} onSubmit={onSubmit}>
          <InputRadioGroupFormHandler {...args} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputRadioGroupFormHandler">Submit</SubmitButton>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputRadioGroupFormHandler',
      },
    },
  },
  args: {
    name: 'radioGroup',
    dataTestId: 'dataTestId',
    disabled: false,
    size: 'md',
    viewType: 'edit',
    list: [
      {
        label: 'Вариант 1',
        value: 'radioButtonValue1',
        helperText: 'Дополнительный текст',
      },
      {
        label: 'Вариант 2',
        value: 'radioButtonValue2',
        helperText: 'Дополнительный текст',
      },
      {
        label: 'Вариант 3',
        value: 'radioButtonValue3',
        helperText: 'Дополнительный текст',
      },
    ],
    onChange: action('onChange'),
  },
  render: (args) => <InputRadioGroupFormHandlerTemplate {...args} />,
};
