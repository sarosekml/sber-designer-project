import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

export default {
  title: 'Atoms/ProgressBar',
  component: ProgressBar,
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
} as Meta;

const Template: StoryFn<typeof ProgressBar> = (args) => <ProgressBar {...args} />;

export const Main = Template.bind({});
Main.args = {
  value: 50,
  label: 'Вероятность сделки',
};
