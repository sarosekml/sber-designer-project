import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { PermissionDeniedPage } from '@/index';

export default {
  title: 'Organisms/PermissionDeniedPage',
  component: PermissionDeniedPage,
  parameters: {
    backgrounds: {
      default: 'light swamp',
    },
    docs: {
      description: {
        story: 'PermissionDeniedPage',
      },
    },
  },
} as Meta<typeof PermissionDeniedPage>;

const Template: StoryFn<typeof PermissionDeniedPage> = (args) => <PermissionDeniedPage {...args} />;

export const AMain = Template.bind({});
AMain.args = {
  onReturnToMain: () => console.log('onReturnToMain'),
};
