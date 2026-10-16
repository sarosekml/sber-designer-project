import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { EmptyModal } from './EmptyModal';

export default {
  title: 'Molecules/EmptyModal',
  component: EmptyModal,
  argTypes: {
    width: { control: 'text' },
    children: { control: 'text' },
  },
} as Meta;

const Template: StoryFn<typeof EmptyModal> = (args) => <EmptyModal {...args} />;

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  height: '200px',
  children: 'Здесь находится контент',
  show: true,
};

Main.parameters = {
  previewTabs: {
    'storybook/docs/panel': {
      hidden: true,
    },
  },
  viewMode: 'canvas',
};
