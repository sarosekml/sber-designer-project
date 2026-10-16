import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { EmptyCellPlaceholder } from '.';

export default {
  title: 'Atoms/EmptyCellPlaceholder',
  component: EmptyCellPlaceholder,
} as Meta;

const Template: StoryFn<typeof EmptyCellPlaceholder> = () => (
  <Grid container spacing={3} gap={3}>
    <EmptyCellPlaceholder />
  </Grid>
);

export const Main = Template.bind({});
