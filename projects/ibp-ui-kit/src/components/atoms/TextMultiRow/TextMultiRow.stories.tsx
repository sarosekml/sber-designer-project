import React from 'react';
import { Grid, Theme, useTheme } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';

import { Text } from '../typography';

import { TextMultiRow } from './TextMultiRow';
import { TextMultiRowProps } from './TextMultiRow.types';

export default {
  title: 'Atoms/TextMultiRow',
  component: TextMultiRow,
} as Meta;

const Template: StoryFn<typeof TextMultiRow> = (args) => <TextMultiRow {...args} />;

export const Main = Template.bind({});

const lorem =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Diam vel quam elementum pulvinar. Mattis rhoncus urna neque viverra justo. Elementum integer enim neque volutpat ac tincidunt vitae. Viverra maecenas accumsan lacus vel facilisis. Dui sapien eget mi proin sed libero enim sed faucibus. Nisi lacus sed viverra tellus. Orci nulla pellentesque dignissim enim sit amet venenatis urna. Sed adipiscing diam donec adipiscing tristique risus nec. Amet venenatis urna cursus eget. Urna et pharetra pharetra massa massa ultricies. In cursus turpis massa tincidunt dui ut. Ut tristique et egestas quis ipsum suspendisse ultrices.';

const props: TextMultiRowProps = {
  children: lorem,
  text: lorem,
  dataTestId: 'stories',
  lineClamp: 2,
  enterDelay: 1500,
  size: 'lg',
  noTooltip: false,
  trimmingLength: 10,
  sx: { color: 'auto' },
};

Main.args = { ...props };

const LineClampAutoTemplate: StoryFn<typeof TextMultiRow> = (args) => {
  const theme = useTheme<Theme>();

  return (
    <>
      <Text type={'H4StrongSmb'} sx={{ textAlign: 'center', p: 4 }}>
        Потяни панель с пропами
      </Text>

      <Grid
        sx={{
          height: '70vh',
          width: '500px',
          p: 3,
          m: 'auto',
          borderRadius: 2,
          border: `1px solid ${theme.palette.Border.BorderPrimary}`,
        }}
      >
        <TextMultiRow {...args} />
      </Grid>
    </>
  );
};

export const LineClampAuto = LineClampAutoTemplate.bind({});

LineClampAuto.args = { ...props, lineClamp: 'auto' };
