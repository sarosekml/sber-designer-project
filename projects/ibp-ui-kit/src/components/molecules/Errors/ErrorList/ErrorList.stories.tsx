import React from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { ErrorList } from './ErrorList';

const meta: Meta<typeof ErrorList> = {
  title: 'Molecules/Errors/ErrorList',
  component: ErrorList,
  tags: ['autodocs'],
  parameters: {
    default: 'light swamp',
  },
  argTypes: {
    alertTitle: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof ErrorList>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение ErrorList',
      },
    },
  },
  args: {
    alertTitle: 'Error',
    errors: ['Unauthorized', 'Not found'],
    removeError: action('removeError'),
  },
};
