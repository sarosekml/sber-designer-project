import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'editor',
      values: [{ name: 'editor', value: '#fafafa' }],
    },
  },
};

export default preview;
