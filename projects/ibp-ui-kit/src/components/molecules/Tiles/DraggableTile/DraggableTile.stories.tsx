import React from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryObj } from '@storybook/react';

import { DraggableTile } from './DraggableTile';

const meta: Meta<typeof DraggableTile> = {
  title: 'Molecules/Tiles/DraggableTile',
  component: DraggableTile,
  tags: ['autodocs'],
  parameters: {
    backgrounds: {
      default: 'whitesmoke',
      values: [{ name: 'whitesmoke', value: 'whitesmoke' }],
    },
  },
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    isDisabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof DraggableTile>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение DraggableTile',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    title: 'КГ Самолёт',
    subtitle: 'Консолидированная группа',
    isDisabled: false,
    children: (
      <Grid container flexDirection={'column'} gap={'8px'}>
        <Grid>ИНН 076543834</Grid>
        <Grid>КПП 33432423423</Grid>
        <Grid>ОГРН 076543834</Grid>
        <Grid>CRM ID 123456</Grid>
        <Grid>КИО 12345</Grid>
      </Grid>
    ),
  },
};
