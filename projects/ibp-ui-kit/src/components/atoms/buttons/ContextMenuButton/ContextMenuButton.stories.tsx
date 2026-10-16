import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { ContextMenuButton } from './ContextMenuButton';
import { anchorMenuDefault, transformMenuDefault } from './ContextMenuButton.const';

export default {
  title: 'Atoms/Buttons/ContextMenuButton',
  component: ContextMenuButton,
  argTypes: {
    dataTestId: { table: { disable: true } },
    disabled: { control: 'boolean' },
    isButtonDisabled: { table: { disable: true } },
  },
} as Meta;

const Template: StoryFn<typeof ContextMenuButton> = (args) => <ContextMenuButton {...args} />;

export const IconButton = Template.bind({});
IconButton.args = {
  dataTestId: 'ContextMenuButtonStories',
  icon: 'MoreDots',
  items: [
    {
      isDisabled: false,
      value: 'Вариант 1',
    },
    {
      isDisabled: true,
      value: 'Вариант 2',
      action: () => console.log('click2'),
    },
    {
      action: () => console.log('click3'),
      isDisabled: false,
      value: 'Вариант 3',
    },
  ],
  onSelectItem: (item) => item.action?.(),
  minWidth: 30,
  anchorMenu: anchorMenuDefault,
  transformMenu: transformMenuDefault,
  type: 'transparent',
};

export const Button = Template.bind({});
Button.args = {
  icon: 'Global',
  viewType: 'button',
  type: 'accent',
  label: 'Change language',

  dataTestId: 'ContextMenuButtonStories',
  items: [
    {
      isDisabled: false,
      value: 'Вариант 1',
    },
    {
      isDisabled: true,
      value: 'Вариант 2',
      action: () => console.log('click2'),
    },
    {
      action: () => console.log('click3'),
      isDisabled: false,
      value: 'Вариант 3',
    },
  ],
  onSelectItem: (item) => item.action?.(),
  minWidth: 30,
  anchorMenu: anchorMenuDefault,
  transformMenu: transformMenuDefault,
  size: 'md',
};
