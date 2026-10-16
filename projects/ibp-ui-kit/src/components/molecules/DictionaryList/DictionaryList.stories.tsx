import React from 'react';
import { Typography } from '@mui/material';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/index';

import { DictionaryList } from './DictionaryList';

const meta: Meta<typeof DictionaryList> = {
  title: 'Molecules/DictionaryList',
  component: DictionaryList,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    spacing: { control: 'number' },
    limit: { control: 'number' },
    expandable: { control: 'boolean' },
    itemShowContentTooltip: { control: 'boolean' },
    itemHoverable: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof DictionaryList>;

const MainComponentOptionsTemplate = (args) => {
  const spacing = 4;
  const colWidth = 4;
  const fullAreaSize = { xs: 12 };

  return (
    <Grid container spacing={spacing}>
      <Grid item container spacing={spacing}>
        <Grid item md={colWidth}>
          <Typography textAlign={'center'}>lg</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <Typography textAlign={'center'}>md</Typography>
        </Grid>
        <Grid item md={colWidth}>
          <Typography textAlign={'center'}>sm</Typography>
        </Grid>
      </Grid>

      <Grid item md={colWidth} alignSelf={'flex-start'} sizes={fullAreaSize}>
        <Typography fontWeight={'bold'}>itemType: edit, itemVariant: outlined</Typography>
      </Grid>
      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth}>
          <DictionaryList {...args} itemVariant={'outlined'} itemType={'edit'} itemSize={'lg'} />
        </Grid>
        <Grid item md={colWidth}>
          <DictionaryList {...args} itemVariant={'outlined'} itemType={'edit'} itemSize={'md'} />
        </Grid>
        <Grid item md={colWidth}>
          <DictionaryList {...args} itemVariant={'outlined'} itemType={'edit'} itemSize={'sm'} />
        </Grid>
      </Grid>

      <Grid item md={colWidth} alignSelf={'flex-start'} sizes={fullAreaSize}>
        <Typography fontWeight={'bold'}>itemType: read, itemVariant: outlined</Typography>
      </Grid>
      <Grid item container spacing={spacing} alignItems={'baseline'}>
        <Grid item md={colWidth}>
          <DictionaryList {...args} itemVariant={'outlined'} itemType={'read'} itemSize={'lg'} />
        </Grid>
        <Grid item md={colWidth}>
          <DictionaryList {...args} itemVariant={'outlined'} itemType={'read'} itemSize={'md'} />
        </Grid>
        <Grid item md={colWidth}>
          <DictionaryList {...args} itemVariant={'outlined'} itemType={'read'} itemSize={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение DictionaryList',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    expandable: true,
    data: [
      { code: 'chip1', name: 'ChipName1' },
      { code: 'chip2', name: 'ChipName2' },
      { code: 'chip3', name: 'ChipName3' },
      { code: 'chip4', name: 'ChipName4' },
    ],
    itemSize: 'lg',
    itemType: 'edit',
    itemVariant: 'outlined',
    itemDisabled: false,
    itemComponent: 'Chip',
    limit: 2,
    spacing: 1,
    onItemClick: action('onItemClick'),
    onItemDelete: action('onItemDelete'),
  },
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения DictionaryList',
      },
    },
  },
  args: { ...Main.args },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
