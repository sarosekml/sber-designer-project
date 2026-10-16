import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { DictionaryBadge } from './DictionaryBadge';
import TagFacesIcon from '@mui/icons-material/TagFaces';

export default {
  title: 'Atoms/DictionaryBadgeSingle',
  component: DictionaryBadge,
  parameters: {},
  argTypes: {
    disabled: { control: 'boolean' },
    onClick: { table: { disable: true } },
    onDelete: { table: { disable: true } },
    dataTestId: { table: { disable: true } },
    hoverable: { control: 'boolean' },
  },
} as Meta<typeof DictionaryBadge>;

export const Main: StoryFn<typeof DictionaryBadge> = (args) => (
  <Grid container spacing={3}>
    <Grid item xs={6}>
      <DictionaryBadge {...args} />
    </Grid>
  </Grid>
);

Main.args = {
  dataTestId: 'stories',
  variant: 'outlined',
  code: 'Atoms/DictionaryBadge',
  name: 'Atoms/DictionaryBadge',
  component: 'Chip',
  size: 'md',
  type: 'edit',
  disabled: false,
  active: false,
  hoverable: true,
  startIcon: <TagFacesIcon />,
};

Main.parameters = {
  backgrounds: {
    default: 'light swamp',
  },
  docs: {
    description: {
      story: 'Atoms/DictionaryBadge',
    },
  },
};
