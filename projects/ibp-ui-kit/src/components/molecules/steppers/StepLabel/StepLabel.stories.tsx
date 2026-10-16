import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { subStepperTypeValues } from '../Stepper';

import { StepLabel } from './StepLabel';

const meta: Meta<typeof StepLabel> = {
  title: 'Molecules/Steppers/StepLabel',
  component: StepLabel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'StepLabel используется в компоненте Stepper',
      },
    },
  },
  argTypes: {
    active: { type: 'boolean' },
    completed: { type: 'boolean' },
    dataTestId: { description: 'StepLabel' },
    disabled: { type: 'boolean' },
    iconVisible: { type: 'boolean' },
    cursorPointer: { type: 'boolean' },
    stepperType: {
      defaultValue: 'checkmark',
      options: subStepperTypeValues,
      control: { type: 'radio' },
    },
  },
};
export default meta;
type Story = StoryObj<typeof StepLabel>;

export const ForStandardStepper: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение StepLabel для стандартного stepper',
      },
    },
  },
  args: {
    children: 'Согласование',
    completed: false,
    dataTestId: 'stories',
    helperText: 'Не используется в сделке',
    stepperType: 'checkmark',
  },
};

export const ForStepperAsList: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение StepLabel для списка',
      },
    },
  },
  args: {
    ...ForStandardStepper.args,
    helperText: '',
    stepperType: 'arrowed',
  },
};
