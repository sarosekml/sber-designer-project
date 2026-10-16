import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { StoryFn } from '@storybook/react';

import { Grid, Text } from '@/index';

import { InputSwitch } from '../InputSwitch';

const meta: Meta<typeof InputSwitch> = {
  title: 'Molecules/Inputs/InputSwitch/InputSwitch',
  component: InputSwitch,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },

    disabled: { control: 'boolean' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
      control: { type: 'radio' },
    },
    checked: { control: 'boolean' },
    helperText: { control: 'text' },
    label: { control: 'text' },
    name: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputSwitch>;

const MainComponentOptionsTemplate: StoryFn = (args) => {
  return (
    <Grid container spacing={6}>
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}></Grid>
        <Grid item xs={3}>
          Lg
        </Grid>
        <Grid item xs={3}>
          Md
        </Grid>
        <Grid item xs={3}>
          Sm
        </Grid>
      </Grid>
      {/** Unselected */}
      {/** Default view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={12}>
          <Text type={'H4StrongSmb'}>Unselected</Text>
        </Grid>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Default</Text>
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked={false} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked={false} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked={false} size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled/Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} disabled size={'sm'} />
        </Grid>
      </Grid>

      {/** Selected */}
      {/** Default view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={12}>
          <Text type={'H4StrongSmb'}>Selected</Text>
        </Grid>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Default</Text>
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled/Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputSwitch {...args} checked disabled size={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputSwitch',
      },
    },
  },
  args: {
    checked: false,
    dataTestId: 'InputSwitch',
    disabled: false,
    helperText: 'Helper text',
    label: 'Text',
    name: 'SwitchHappy',
    onChange: action('onChange'),
    size: 'md',
    viewType: 'edit',
  },
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputSwitch',
      },
    },
  },
  args: {
    ...Main.args,
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
