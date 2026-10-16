import React from 'react';
import { Grid, useTheme } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { Icon } from '../Icon';

import { Avatar } from './Avatar';
import { AvatarProps } from './Avatar.types';

export default {
  title: 'Atoms/Avatar',
  component: Avatar,
} as Meta<AvatarProps>;

const Template: StoryFn<AvatarProps> = (args) => {
  const theme = useTheme();

  return (
    <Grid container spacing={3} gap={3} padding={'20px'}>
      <Grid container spacing={3} gap={3}>
        <Grid item>{'Avatar'}</Grid>
        <Grid item container spacing={2}>
          <Grid item>
            <Avatar {...args} />
          </Grid>
          <Grid item>
            <Avatar {...args} name={'Иванов Иван Иванович'} />
          </Grid>
          <Grid item>
            <Avatar {...args} sx={{ bgcolor: theme.palette.Secondary.SecondaryBG }} variant="rounded">
              <Icon
                name={'LayersThree01'}
                size={args.size === 'xl' ? 'lg' : args.size}
                sx={{ color: theme.palette.Tertiary.TertiaryDark }}
              />
            </Avatar>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main = Template.bind({});

Main.args = {
  size: 'lg',
};

Main.parameters = {
  backgrounds: {
    default: 'white',
  },
};
