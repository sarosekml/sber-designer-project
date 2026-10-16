import React from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryObj } from '@storybook/react';

import { Text } from '@/index';

import { Counter } from './Counter';
import { ListCounter } from './ListCounter';

const meta: Meta<typeof Counter> = {
  title: 'Atoms/Counter',
  component: Counter,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Counter>;
type StoryListCounter = StoryObj<typeof ListCounter>;

const MainTemplate = (args) => (
  <Grid container>
    <Counter {...args} />
  </Grid>
);

const ListCounterTemplate = (args) => (
  <Grid container>
    <ListCounter {...args} />
  </Grid>
);

const MainComponentOptionsTemplate = (args) => {
  return (
    <Grid container spacing={2}>
      <Grid container justifyContent={'center'}>
        <Grid item xs={3}></Grid>
        <Grid item xs={3}>
          <Text align={'center'}>Ld</Text>
        </Grid>
        <Grid item xs={3}>
          <Text align={'center'}>Md</Text>
        </Grid>
        <Grid item xs={3}>
          <Text align={'center'}>Sm</Text>
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={3}>
          <Text>Edit/filled</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <ListCounter {...args} type={'edit'} variant={'filled'} size={'lg'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'}>
          <ListCounter {...args} type={'edit'} variant={'filled'} size={'md'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'}>
          <ListCounter {...args} type={'edit'} variant={'filled'} size={'sm'} />
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={3}>
          <Text>Edit/transparent</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <ListCounter {...args} type={'edit'} variant={'transparent'} size={'lg'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <ListCounter {...args} type={'edit'} variant={'transparent'} size={'md'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <ListCounter {...args} type={'edit'} variant={'transparent'} size={'sm'} />
        </Grid>
      </Grid>

      <Grid container>
        <Grid item xs={3}>
          <Text>Read/filled</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <ListCounter {...args} type={'read'} variant={'filled'} size={'lg'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <ListCounter {...args} type={'read'} variant={'filled'} size={'md'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <ListCounter {...args} type={'read'} variant={'filled'} size={'sm'} />
        </Grid>
      </Grid>

      <Grid container>
        <Grid item xs={3}>
          <Text>Read/transparent</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <ListCounter {...args} type={'read'} variant={'transparent'} size={'lg'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <ListCounter {...args} type={'read'} variant={'transparent'} size={'md'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <ListCounter {...args} type={'read'} variant={'transparent'} size={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Counter',
      },
    },
  },
  args: {
    dataTestId: 'Counter_dataTestId',
    count: 5,
    variant: 'filled',
    size: 'lg',
  },
  render: (args) => <MainTemplate {...args} />,
};

export const ListСounter: StoryListCounter = {
  parameters: {
    docs: {
      description: {
        story: 'ListCounter обёртка над Counter. Позволяет обрезать значение и отобразить его с "+"',
      },
    },
  },
  args: {
    ...Main.args,
    cutCount: 0,
    count: 5,
  },
  render: (args) => <ListCounterTemplate {...args} />,
};

export const MainComponentOptions: StoryListCounter = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения ListCounter',
      },
    },
  },
  args: {
    ...ListСounter.args,
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
