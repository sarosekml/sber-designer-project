import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { FilterPresetList } from './FilterPresetList';

export default {
  title: 'Molecules/FilterPresets/FilterPresetList',
  component: FilterPresetList,
  argTypes: {
    dataTestId: {
      description: 'FilterPresetList',
    },
    hasSpot: {
      control: false,
    },
  },
} as Meta<typeof FilterPresetList>;

const Template: StoryFn<typeof FilterPresetList> = (args) => <FilterPresetList {...args} />;
export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  presets: [
    {
      active: false,
      filters: {
        name: 'name',
      },
      name: 'Preset 1',
      objectId: '1',
    },
    {
      active: false,
      filters: {
        number: 1,
      },
      name: 'Preset 2',
      objectId: '2',
    },
    {
      active: false,
      filters: {
        date: '2026-01-01',
      },
      name: 'Preset 3',
      objectId: '3',
    },
  ],
};
