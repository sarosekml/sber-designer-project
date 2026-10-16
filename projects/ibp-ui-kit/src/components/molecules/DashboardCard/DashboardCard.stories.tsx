import React from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { AdministrationIcon } from '@/components/atoms';

import { DashboardCard } from './DashboardCard';

const meta: Meta<typeof DashboardCard> = {
  title: 'Molecules/DashboardCard',
  component: DashboardCard,
  parameters: {
    backgrounds: {
      default: 'light swamp',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    text: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof DashboardCard>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение DashboardCard',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    title: 'Администрирование',
    text: 'Справочники и другая информация',
    disabled: false,
    icon: AdministrationIcon,
    onCardClick: action('onCardClick'),
  },
};

export const CardWithoutIcon: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение DashboardCard с иконкой',
      },
    },
  },
  args: {
    ...Main.args,
    title: 'Справочники',
    text: 'Карточка без заголовка',
  },
};
