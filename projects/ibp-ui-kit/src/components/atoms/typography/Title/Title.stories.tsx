import { Title } from './Title';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

export default {
  title: 'Atoms/Typography/Title',
  component: Title,
  argTypes: {
    dataTestId: {
      description: 'Title',
    },
  },
} as Meta;
const Template: StoryFn<typeof Title> = (args) => (
  <Title dataTestId="stories" {...args}>
    {'' || args.children}
  </Title>
);

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  children: 'Hello world',
  type: 'title',
};
