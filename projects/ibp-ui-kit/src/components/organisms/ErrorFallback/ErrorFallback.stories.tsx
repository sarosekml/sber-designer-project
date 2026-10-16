import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { ErrorFallback } from './ErrorFallback';

export default {
  title: 'Organisms/ErrorFallback',
  component: ErrorFallback,
  parameters: {
    backgrounds: {
      default: 'light swamp',
    },
    docs: {
      description: {
        story: 'ErrorFallback',
      },
    },
  },
} as Meta<typeof ErrorFallback>;

const Template: StoryFn<typeof ErrorFallback> = (args) => <ErrorFallback {...args} />;

export const AMain = Template.bind({});
AMain.args = {
  customNavigate: () => console.log('customNavigate'),
  resetErrorBoundary: () => console.log('resetErrorBoundary'),
  error: { name: 'name', message: 'Сообщение об ошибке' },
};
