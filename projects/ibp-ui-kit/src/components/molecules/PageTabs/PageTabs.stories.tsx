import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { PageTabs } from './PageTabs';

const meta: Meta<typeof PageTabs> = {
  title: 'Molecules/PageTabs',
  component: PageTabs,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    locationPathname: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof PageTabs>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение PageTabs',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    locationPathname: '/',
    navigateCallback: (route) => console.log(route),
    routeMap: {
      home: {
        name: 'Home',
        pagePath: '/home',
        route: '/home',
      },
      about: {
        name: 'About',
        pagePath: '/about',
        route: '/about',
      },
    },
    tabList: ['home', 'about'],
  },
};
