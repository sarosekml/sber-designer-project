import { Grid } from '@mui/material';
import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { Button } from '../buttons';
import { Tooltip } from './Tooltip';
import { TooltipProps } from './Tooltip.types';

export default {
  title: 'Atoms/Tooltip',
  component: Tooltip,
  argTypes: {
    open: { control: { disable: true }, table: { disable: true } },
    enterDelay: { description: 'Shows delay in showing Tooltip in milliseconds' },
    trimmingLength: { description: 'MaxLength of tooltip before ellipsis, defaults to 200 signs' },
    title: { description: 'Text for tooltip' },
    isHint: { table: { disable: true } },
    dataTestId: { table: { disable: true } },
    disabled: { control: 'boolean', defaultValue: false },
    arrowShift: {
      description:
        'Distance in pixels for arrow tip to be from closest side edge of tooltip to match needed point, defaults to 12px',
    },
  },
} as Meta;

const Template: StoryFn<typeof Tooltip> = (args) => (
  <Grid
    width={'100%'}
    minHeight={'200px'}
    height={'100%'}
    alignItems={'center'}
    display={'flex'}
    justifyContent={'center'}
  >
    <Grid>
      <Tooltip {...args} />
    </Grid>
  </Grid>
);

const props: TooltipProps = {
  title: 'Lorem text',
  disabled: false,
  children: <Button dataTestId={'TestBtn'}>Point at me</Button>,
  dataTestId: 'stories',
  placement: 'bottom',
  enterDelay: 1000,
  type: 'hint',
  arrow: 'center',
};

export const AMain: StoryFn<typeof Tooltip> = Template.bind({});
AMain.args = {
  ...props,
};

export const BError: StoryFn<typeof Tooltip> = Template.bind({});
BError.args = {
  ...props,
  type: 'error',
  open: true,
};

export const CDefaultTooltip: StoryFn<typeof Tooltip> = Template.bind({});
CDefaultTooltip.args = {
  ...props,
  type: 'default',
  open: true,
};

export const DHint: StoryFn<typeof Tooltip> = Template.bind({});
DHint.args = {
  ...props,
  open: true,
};

export const ENoArrow: StoryFn<typeof Tooltip> = Template.bind({});
ENoArrow.args = {
  title: 'Lorem text',
  disabled: false,
  children: <Button dataTestId={'TestBtn'}>Point at me</Button>,
  dataTestId: 'stories',
  placement: 'right',
  type: 'hint',
  open: true,
  arrow: 'none',
};

export const HTMLTooltip: StoryFn<typeof Tooltip> = (args) => (
  <Grid
    width={'100%'}
    minHeight={'200px'}
    height={'100%'}
    alignItems={'center'}
    display={'flex'}
    justifyContent={'center'}
    spacing={2}
    container
  >
    <Grid item>
      <Tooltip {...args} />
    </Grid>
    <Grid item>
      <Button dataTestId={'btn'}>hovered</Button>
    </Grid>
  </Grid>
);

HTMLTooltip.args = {
  title: <h1>Hello world</h1>,
  disabled: false,
  children: <Button dataTestId={'TestBtn'}>Point at me</Button>,
  dataTestId: 'stories',
  placement: 'right',
  type: 'hint',
  open: true,
  arrow: 'none',
};
