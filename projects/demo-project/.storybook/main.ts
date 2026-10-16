import { mergeConfig } from 'vite';
import type { StorybookConfig } from '@storybook/react-vite';

import { sdLocVitePlugin } from '../tools/sd-loc-vite-plugin.ts';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'],
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [sdLocVitePlugin()],
    });
  },
};

export default config;

