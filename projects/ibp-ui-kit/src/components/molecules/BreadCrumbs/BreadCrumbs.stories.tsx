import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { BreadCrumbs } from './BreadCrumbs';

const meta: Meta<typeof BreadCrumbs> = {
  title: 'Molecules/BreadCrumbs',
  component: BreadCrumbs,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof BreadCrumbs>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение BreadCrumbs',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    navigationSchema: [
      { name: 'Главная', route: '/main' },
      { name: 'Текущий портфель ДИД', route: '/main/portfolio' },
      { name: 'Сделки моего деска', route: '/main/portfolio/my-desk' },
      { name: 'Мои сделки', route: '/main/portfolio/my-desk/deals' },
      { name: '1234. СамолетИнвестПродакшн', route: '/main/portfolio/my-desk/deals/102030' },
    ],
    onClickLink: action('onClickLink has been clicked'),
  },
};

export const WithDropdownBreadCrumbs: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение BreadCrumbs c выпадающим списком (кол-во хлеб. крошек > 5)',
      },
    },
  },
  args: {
    ...Main.args,
    navigationSchema: [...(Main.args?.navigationSchema ?? []), { name: 'Текущая страница', route: '' }],
  },
};
