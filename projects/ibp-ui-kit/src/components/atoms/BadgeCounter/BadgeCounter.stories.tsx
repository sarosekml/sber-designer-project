import React from 'react';

import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { BadgeCounter, BadgeCounterProps } from './BadgeCounter';

export default {
  title: 'Atoms/BadgeCounter',
  component: BadgeCounter,
} as Meta<typeof BadgeCounter>;

const Template: StoryFn<typeof BadgeCounter> = (args) => (
  <Grid container spacing={3} gap={3} padding={'20px'}>
    <Grid container spacing={3} gap={3}>
      <Grid item>{'BadgeCounter'}</Grid>
      <Grid item container>
        <BadgeCounter {...args} />
      </Grid>
    </Grid>

    <Grid container spacing={1}>
      <Grid item>{'sm'}</Grid>
      <Grid item container>
        <BadgeCounter size={'sm'} counter={0} />
        <BadgeCounter size={'sm'} counter={1} />
        <BadgeCounter size={'sm'} counter={99} />
        <BadgeCounter size={'sm'} counter={100_000_000} />
      </Grid>
    </Grid>

    <Grid container spacing={1}>
      <Grid item>{'md'}</Grid>
      <Grid item container>
        <BadgeCounter size={'md'} counter={0} />
        <BadgeCounter size={'md'} counter={1} />
        <BadgeCounter size={'md'} counter={99} />
        <BadgeCounter size={'md'} counter={100_000_000} />
      </Grid>
    </Grid>
  </Grid>
);

export const Main = Template.bind({});

const props: BadgeCounterProps = {
  counter: 123_456_789,
  size: 'sm',
};

Main.args = {
  ...props,
};

Main.parameters = {
  backgrounds: {
    default: 'white',
  },
};
