import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { Paper } from './Paper';

export default {
  title: 'Atoms/Paper',
  component: Paper,
  argTypes: {
    dataTestId: {
      description: 'Paper',
    },
  },
} as Meta;

const Template: StoryFn<typeof Paper> = (args) => <Paper {...args} />;
export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
};
