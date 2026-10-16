import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { FilterPresetRow } from './FilterPresetRow';

export default {
  title: 'Molecules/FilterPresets/FilterPresetRow',
  component: FilterPresetRow,
  argTypes: {
    dataTestId: {
      description: 'FilterPresetRow',
    },
    hasSpot: {
      control: false,
    },
  },
} as Meta<typeof FilterPresetRow>;

const Template: StoryFn<typeof FilterPresetRow> = (args) => <FilterPresetRow {...args} />;
export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  preset: {
    active: false,
    filters: [],
    name: 'Preset 1 Preset 1 Preset 1 Preset 1 Preset 1Preset 1 Preset 1 Preset 1 Preset 1',
    objectId: '',
  },
};
