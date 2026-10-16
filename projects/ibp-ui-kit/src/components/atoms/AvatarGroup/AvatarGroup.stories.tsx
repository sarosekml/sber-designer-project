import React from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { Icon } from '@/index';

import { Avatar } from '../Avatar';

import { AvatarGroup, AvatarGroupProps } from './AvatarGroup';

export default {
  title: 'Atoms/AvatarGroup',
  component: AvatarGroup,
} as Meta<AvatarGroupProps>;

const Template: StoryFn<AvatarGroupProps> = (args) => (
  <Grid container spacing={3} gap={3} padding={'20px'}>
    <Grid container spacing={3} gap={3}>
      <Grid item>{'AvatarGroup'}</Grid>
      <Grid item container>
        <AvatarGroup {...args}>
          <Avatar>
            <Icon name={'Add'} size={'lg'} color="inherit" />
          </Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
          <Avatar>sd</Avatar>
        </AvatarGroup>
      </Grid>
    </Grid>
  </Grid>
);

export const Main = Template.bind({});

Main.args = {};

Main.parameters = {
  backgrounds: {
    default: 'white',
  },
};
