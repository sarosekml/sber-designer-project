import { Meta, StoryObj } from '@storybook/react';

import { ListItemButton } from './ListItemButton';

const meta: Meta<typeof ListItemButton> = {
  title: 'Atoms/ListItemButton',
  component: ListItemButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Элемент списка',
      },
    },
  },
  argTypes: {
    disabled: {
      control: 'boolean',
    },
    onClick: {
      table: { disable: false },
    },
  },
};
export default meta;

type Story = StoryObj<typeof ListItemButton>;
export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение элемента выпадающего списка',
      },
    },
  },
  args: {
    dataTestId: 'ContextMenu',
    onClick: (item) => console.log(`click ${item}`),
    disabled: false,
    children: 'Context Menu Item',
  },
};
