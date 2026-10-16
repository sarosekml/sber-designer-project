import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { DashboardGroupHeader } from './DashboardGroupHeader';
import { DashboardGroupHeaderProps } from './DashboardGroupHeader.types';

export default {
  title: 'Atoms/Header/DashboardGroupHeader',
  component: DashboardGroupHeader,
} as Meta;

const Template: StoryFn<typeof DashboardGroupHeader> = (args) => <DashboardGroupHeader {...args} />;

const props: DashboardGroupHeaderProps = {
  children: 'Deals',
  dataTestId: 'stories',
};

export const Main = Template.bind({});
Main.args = {
  ...props,
};
