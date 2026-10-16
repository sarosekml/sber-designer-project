import { Meta, StoryFn } from '@storybook/react';
import React, { useState } from 'react';
import { SegmentControl } from './SegmentControl';
import { SegmentControlProps } from './SegmentControl.types';

export default {
  title: 'Atoms/SegmentControl',
  component: SegmentControl,
  argTypes: {
    dataTestId: {
      description: 'SegmentControl',
    },
    size: {
      options: ['lg', 'md', 'sm', 'xs'],
      control: { type: 'radio' },
    },
  },
} as Meta<typeof SegmentControl>;

const Template: StoryFn<typeof SegmentControl> = (args) => {
  const [index, setIndex] = useState(0);

  return <SegmentControl selectedIndex={index} onIndexChange={setIndex} {...args} />;
};

const props: SegmentControlProps = {
  segmentsText: ['React', 'Redux', 'TypeScript'],
  disabled: false,
  size: 'md',
  dataTestId: 'SegmentControl',
};

export const Main = Template.bind({});

Main.args = {
  ...props,
};
