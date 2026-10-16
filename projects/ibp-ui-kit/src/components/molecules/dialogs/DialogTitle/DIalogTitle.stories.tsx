import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { DialogTitle } from './DialogTitle';

export default {
  title: 'Molecules/Dialogs/DialogTitle',
  component: DialogTitle,
  argTypes: {
    children: {
      description: 'DialogTitle children',
    },
    dataTestId: {
      description: 'DialogTitle',
    },
  },
} as Meta;

const Template: StoryFn<typeof DialogTitle> = (args) => <DialogTitle {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  children: 'Lorem text',
};
