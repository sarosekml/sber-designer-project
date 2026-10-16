import React from 'react';
import { Meta, StoryObj } from '@storybook/react';

import { Button, Grid, Icon, Page } from '@/components/atoms';

import { Card } from '../Card';

import { PageBar } from './PageBar';

const meta: Meta<typeof PageBar> = {
  title: 'Molecules/PageBar',
  component: PageBar,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    isStickButtonLeft: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof PageBar>;

const PageBarWithButtonTemplate = (args) => {
  return (
    <Page dataTestId={'Page'}>
      <PageBar {...args} />

      <Grid container spacing={4}>
        <Grid xs={12} item></Grid>
        <Grid xs={12} item>
          <Card dataTestId={'stories'}>Some component</Card>
        </Grid>
        <Grid xs={12} item>
          <Card dataTestId={'stories'}>Some component</Card>
        </Grid>
        <Grid xs={12} item>
          <Card dataTestId={'stories'}>Some component</Card>
        </Grid>
      </Grid>
    </Page>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение PageBar',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    title: 'Pipeline',
    prefix: <Icon name={'ImportantDeals'} color={'warning'} size={'sm'} />,
    extra: (
      <Button startIcon={'Add'} dataTestId={'CreateOpportunity'}>
        Новая сделка
      </Button>
    ),
    subExtra: (
      <Grid item xs={12} data-testid={'test'}>
        SubExtra
      </Grid>
    ),
    subTitle: (
      <Grid item xs={12} data-testid={'test'}>
        SubTitle
      </Grid>
    ),
    titlePostfix: (
      <Grid item xs={12} data-testid={'test'}>
        TitlePostfix
      </Grid>
    ),
    titlePrefix: (
      <Grid item xs={12} data-testid={'test'}>
        TitlePrefix
      </Grid>
    ),
    isStickButtonLeft: false,
  },
  render: (args) => <PageBarWithButtonTemplate {...args} />,
};
