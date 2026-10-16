import React from 'react';
import { Grid } from '@mui/material';
import { Meta, StoryObj } from '@storybook/react';

import { Text } from '@/index';
import { theme } from '@/styles';

import { RiskMetricsBadge } from './RiskMetricsBadge';
import { problemZoneTypes } from './RiskMetricsBadge.types';

const meta: Meta<typeof RiskMetricsBadge> = {
  title: 'Atoms/RiskMetricsBadge',
  component: RiskMetricsBadge,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    problemZone: { control: 'text' },
    rating: { control: 'text' },
    colorScheme: { control: 'object' },
  },
};
export default meta;

type Story = StoryObj<typeof RiskMetricsBadge>;

const RiskMetricsBadgeStory = () => {
  return (
    <Grid>
      {problemZoneTypes.map((zone, index) => (
        <Grid container sx={{ justifyContent: 'space-between', alignItems: 'center', width: '400px' }} item key={index}>
          <Text>{zone}</Text>
          <RiskMetricsBadge key={zone} problemZone={zone} rating={`${index + 11}`} />
        </Grid>
      ))}
      <Grid container sx={{ justifyContent: 'space-between', alignItems: 'center', width: '400px' }} item>
        <Text>Default</Text>
        <RiskMetricsBadge rating={'15'} />
      </Grid>

      <Grid container sx={{ justifyContent: 'space-between', alignItems: 'center', width: '400px' }} item>
        <Text>With own colorScheme</Text>
        <RiskMetricsBadge
          colorScheme={{
            Black: {
              backgroundColor: theme.palette.Info.InfoLight,
              textColor: theme.palette.BG.BGTile,
            },
          }}
          problemZone={'Black'}
          rating={'15'}
        />
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  args: {},
  render: () => <RiskMetricsBadgeStory />,
};
