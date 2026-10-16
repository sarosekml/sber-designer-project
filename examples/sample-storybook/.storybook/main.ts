import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
  // No viteFinal customization — sber-designer relies on @vitejs/plugin-react's
  // built-in @babel/plugin-transform-react-jsx-source instrumentation, which is
  // on by default in development. See ADR-0007.
};

export default config;
