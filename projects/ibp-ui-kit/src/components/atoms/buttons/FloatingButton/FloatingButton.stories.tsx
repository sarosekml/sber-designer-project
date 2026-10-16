import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { Icon } from '../../Icon';

import { FloatingButton } from './FloatingButton';
import { defaultFloatingButtonTheme } from './FloatingButton.style';

export default {
  title: 'Molecules/FloatingButton',
  component: FloatingButton,
  argTypes: {
    width: { control: 'text' },
    children: { control: 'text' },
  },
} as Meta;

const Template: StoryFn<typeof FloatingButton> = (_args) => (
  <React.Fragment>
    <FloatingButton colorThemeSx={defaultFloatingButtonTheme}>
      <Icon name="Add" />
    </FloatingButton>
    <FloatingButton>
      <Icon name="Check" />
    </FloatingButton>
  </React.Fragment>
);

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  children: 'Здесь находится контент',
};

Main.parameters = {
  previewTabs: {
    'storybook/docs/panel': {
      hidden: true,
    },
  },
  viewMode: 'canvas',
};
