import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { Skeleton } from './Skeleton';

export default {
  title: 'Atoms/Skeleton',
  component: Skeleton,
  argTypes: {
    animation: { options: ['pulse', 'wave', undefined, false], control: { type: 'select' } },
    width: { control: { type: 'range', min: 100, max: 600, step: 10 } },
    height: { control: { type: 'range', min: 100, max: 300, step: 10 } },
    dataTestId: {
      description: 'Skeleton',
    },
  },
} as Meta;

const Template: StoryFn<typeof Skeleton> = (args) => <Skeleton {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
};
