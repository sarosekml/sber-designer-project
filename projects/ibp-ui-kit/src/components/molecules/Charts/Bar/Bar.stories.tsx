import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Bar } from './Bar';
import { chartData } from './Bar.mock';

const meta: Meta<typeof Bar> = {
  title: 'Molecules/Charts/Bar',
  component: Bar,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    width: { control: 'text' },
    height: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof Bar>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Bar',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    data: chartData,
    onClick: action('onClick'),
    width: '100%',
    height: '400px',
  },
};
