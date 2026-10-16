import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { emerald, mGrey } from '@/styles/colors';

import { Pie } from './Pie';

const meta: Meta<typeof Pie> = {
  title: 'Molecules/Charts/Pie',
  component: Pie,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    width: { control: 'text' },
    height: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof Pie>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Pie',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    data: {
      datasets: [
        {
          data: [10, 90],
          backgroundColor: [emerald[500], mGrey[30]],
        },
      ],
    },
    height: 170,
    width: 170,
  },
};
