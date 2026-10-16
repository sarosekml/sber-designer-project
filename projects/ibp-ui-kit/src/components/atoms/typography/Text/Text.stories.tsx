import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { typographyDescription } from '@/documentation/Typography/Typography.const';

import { Text } from './Text';

export default {
  title: 'Atoms/Typography/Text',
  component: Text,
  argTypes: {
    dataTestId: {
      description: 'Text',
    },
    children: {
      description: 'Text',
    },
  },
} as Meta<typeof Text>;

const Template: StoryFn<typeof Text> = (args) => <Text {...args} />;

export const AMain = Template.bind({});
AMain.args = {
  type: 'H1Light',
  children: 'Здесь будет ваш текст',
  dataTestId: 'stories',
};

const AllTextTemplate: StoryFn<typeof Text> = () => (
  <Grid container spacing={2}>
    {typographyDescription
      .flatMap((typo) => typo.data)
      .map(({ kind }) => (
        <Grid key={kind} item xs={12}>
          <Text type={kind} dataTestId={kind}>
            {kind}
          </Text>
        </Grid>
      ))}
  </Grid>
);
export const BAllTextExamples = AllTextTemplate.bind({});
