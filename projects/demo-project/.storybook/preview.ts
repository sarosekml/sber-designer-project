import type { Preview } from '@storybook/react-vite';

import '../src/styles/design-system.css';
import '../src/styles/demo-app.css';
import '../src/styles/storybook-docs.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      storySort: {
        order: ['Foundation', 'Components', 'Patterns', 'Screens'],
      },
    },
  },
};

export default preview;
