import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { emptyString } from '@sber-ibp/core';

import { Grid } from '@/components/atoms';
import { DashboardCard } from '@/components/molecules';

import { Text } from '../typography';

import { dashboardIconsMap } from './DashboardIcon.const';
import { Icon } from './Icon';

const meta: Meta<typeof DashboardCard> = {
  title: 'Atoms/Icon/DashboardIconList',
  component: DashboardCard,
  tags: ['autodocs'],
  argTypes: {},
};
export default meta;

type Story = StoryObj<typeof Icon>;

const DashboardIconList = (_args) => {
  const iconKeys = Object.keys(dashboardIconsMap).sort();
  return (
    <Grid container spacing={3}>
      <Grid item xs={4}>
        <Text type={'H5StrongSmb'}>{'Наименование'}</Text>
      </Grid>
      <Grid item xs={3}>
        <Text type={'H5StrongSmb'}>{'Иконка'}</Text>
      </Grid>
      {iconKeys.map((key) => (
        <Grid container item key={key} spacing={3}>
          <Grid item xs={4} sx={{ backgroundColor: '#cdedcd' }}>
            <Text type={'H6Reg'}>{key}</Text>
          </Grid>
          <Grid item xs={3}>
            <DashboardCard icon={dashboardIconsMap[key]} disabled={false} title={emptyString} />
          </Grid>
        </Grid>
      ))}
    </Grid>
  );
};

export const Main: Story = {
  args: {},
  render: (args) => <DashboardIconList {...args} />,
};
