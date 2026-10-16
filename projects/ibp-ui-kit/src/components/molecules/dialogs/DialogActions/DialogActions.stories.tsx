import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { DialogActions } from './DialogActions';

export default {
  title: 'Molecules/Dialogs/DialogActions',
  component: DialogActions,
  argTypes: {
    children: {
      description: 'Dialog children',
    },
    dataTestId: {
      description: 'DialogActions',
    },
  },
} as Meta;

const Template: StoryFn<typeof DialogActions> = (args) => <DialogActions {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  children: 'Lorem text',
};
