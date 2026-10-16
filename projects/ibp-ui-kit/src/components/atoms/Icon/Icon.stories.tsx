import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';

import { Text } from '../typography';

import { Icon } from './Icon';
import { iconsMap } from './Icon.const';
import { iconsMockMap } from './Icon.mock';

const meta: Meta<typeof Icon> = {
  title: 'Atoms/Icon/IconList',
  component: Icon,
  tags: ['autodocs'],
  argTypes: {},
};
export default meta;

type Story = StoryObj<typeof Icon>;

const IconsList = (_args) => {
  const iconKeys = Object.keys(iconsMockMap).sort();
  return (
    <Grid container spacing={3}>
      <Grid item xs={3}>
        <Text type={'H5StrongSmb'}>{'Список всех иконок'}</Text>
      </Grid>
      <Grid item xs={1}>
        <Text type={'H5StrongSmb'}>SM</Text>
      </Grid>
      <Grid item xs={1}>
        <Text type={'H5StrongSmb'}>MD</Text>
      </Grid>
      <Grid item xs={1}>
        <Text type={'H5StrongSmb'}>LG</Text>
      </Grid>
      <Grid item xs={6}>
        <Text type={'H5StrongSmb'}>{'Старое наименование'}</Text>
      </Grid>
      {iconKeys.map((key) => (
        <Grid container item key={key} spacing={3}>
          <Grid item xs={3} sx={{ backgroundColor: '#cdedcd' }}>
            <Text type={'H6Reg'}>{key}</Text>
          </Grid>
          <Grid item xs={1}>
            <Icon name={key as keyof typeof iconsMap} size={'sm'} />
          </Grid>
          <Grid item xs={1}>
            <Icon name={key as keyof typeof iconsMap} size={'md'} />
          </Grid>
          <Grid item xs={1}>
            <Icon name={key as keyof typeof iconsMap} size={'lg'} />
          </Grid>
          <Grid item xs={6} sx={{ backgroundColor: '#f19f9f' }}>
            <Text type={'H6Reg'}>{iconsMockMap[key].oldName}</Text>
          </Grid>
        </Grid>
      ))}
    </Grid>
  );
};

export const Main: Story = {
  args: {},
  render: (args) => <IconsList {...args} />,
};
