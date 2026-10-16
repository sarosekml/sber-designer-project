import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { Button, ContextMenuButton } from '@/components/atoms/buttons';

import { ButtonGroup } from './ButtonGroup';
import { ButtonGroupProps } from './ButtonGroup.types';

const meta: Meta<ButtonGroupProps> = {
  title: 'Atoms/Buttons/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ButtonGroupProps>;

const MainComponentOptionsTemplate = (args) => (
  <ButtonGroup {...args}>
    <Button>Hello</Button>
    <Button>Hello</Button>
    <ContextMenuButton
      viewType="button"
      icon="ChevronDown"
      label=""
      onSelectItem={() => ({})}
      items={[{ value: 'first action' }, { value: 'second action' }]}
    />
  </ButtonGroup>
);

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение ButtonGroup',
      },
    },
    args: {
      disabled: false,
      size: 'lg',
      type: 'accent',
      fullWidth: false,
      orientation: 'vertical',
    },
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
