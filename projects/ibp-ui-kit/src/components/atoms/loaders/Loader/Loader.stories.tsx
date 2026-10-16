import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import { Loader } from './Loader';

export default {
  title: 'Atoms/Loaders/Loader',
  component: Loader,
  argTypes: {
    isColored: {
      type: 'boolean',
    },
    dataTestId: {
      description: 'Loader',
    },
  },
} as Meta;

const Template: StoryFn<typeof Loader> = (args) => <Loader {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
};

export const OnDarkBackground = Template.bind({});
OnDarkBackground.parameters = {
  backgrounds: { default: 'dark' },
};

OnDarkBackground.args = {
  color: 'white',
};
