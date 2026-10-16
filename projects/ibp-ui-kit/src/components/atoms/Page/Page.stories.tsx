import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { Page } from './Page';

export default {
  title: 'Atoms/Page',
  component: Page,
  argTypes: {
    dataTestId: {
      description: 'Page',
    },
    children: {
      description: 'Page Content',
    },
  },
} as Meta;

const Template: StoryFn<typeof Page> = (args) => <Page {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  children: <p>Page Content</p>,
};
