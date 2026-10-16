import { Meta, StoryObj } from '@storybook/react';

import { ContextMenu } from '@/index';

const contextMenuList: HTMLElement = document.createElement('div');
const items = [
  {
    isDisabled: false,
    value: 'Вариант 1',
  },
  {
    isDisabled: false,
    value: 'Вариант 2',
    action: () => console.log('click2'),
  },
  {
    action: () => console.log('click3'),
    isDisabled: true,
    value: 'Вариант 3',
  },
];

const meta: Meta<typeof ContextMenu> = {
  title: 'Atoms/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Кнопка с выпадающим списком. Возникает когда юзер нажимает на ContextMenuButton, не скролится.',
      },
    },
  },
  argTypes: {
    items: {
      control: 'object',
    },
    dataTestId: { table: { disable: true } },
    contextMenuList: { table: { disable: true } },
    selectHandler: { table: { disable: true } },
    anchorMenu: { table: { disable: true } },
    transformMenu: { table: { disable: true } },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm'],
    },
    minWidth: {
      control: {
        type: 'range',
        min: 30,
        max: 500,
        step: 10,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ContextMenu>;
export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение кнопки-иконки',
      },
    },
  },
  args: {
    items,
    dataTestId: 'ContextMenu',
    contextMenuList,
    selectHandler: (item) => console.log(`click ${item.value}`),
    size: 'lg',
    minWidth: 30,
  },
};
