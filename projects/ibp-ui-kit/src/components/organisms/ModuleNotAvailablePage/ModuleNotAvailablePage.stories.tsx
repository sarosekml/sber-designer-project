import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { ModuleNotAvailablePage } from './ModuleNotAvailablePage';

export default {
  title: 'Organisms/ModuleNotAvailablePage',
  component: ModuleNotAvailablePage,
  parameters: {
    backgrounds: {
      default: 'light swamp',
    },
    docs: {
      description: {
        story: 'ModuleNotAvailablePage',
      },
    },
  },
} as Meta<typeof ModuleNotAvailablePage>;

const Template: StoryFn<typeof ModuleNotAvailablePage> = (args) => <ModuleNotAvailablePage {...args} />;

export const AMain = Template.bind({});
AMain.args = {
  onClickGoHome: () => console.log('navigate'),
  title: 'Выбранный модуль недоступен',
};
