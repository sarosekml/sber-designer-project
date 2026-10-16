import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';

import { Grid, Text } from '@/index';

import { InputRadioButton } from '../InputRadioButton';

const meta: Meta<typeof InputRadioButton> = {
  title: 'Molecules/Inputs/InputRadioButton/InputRadioButton',
  component: InputRadioButton,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    helperText: { control: 'text' },
    label: { control: 'text' },
    name: { control: 'text' },
    value: { control: 'text' },
    id: { control: 'text' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
      control: { type: 'radio' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof InputRadioButton>;

const MainComponentOptionsTemplate = (args) => {
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
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Default</Text>
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled</Text>
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} disabled size={'sm'} />
        </Grid>
      </Grid>
      {/** Readonly view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} viewType={'read'} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} viewType={'read'} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioButton {...args} viewType={'read'} size={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputRadioButton',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    disabled: false,
    helperText: 'Helper text',
    id: 'InputRadioButtonId',
    inputRef: undefined,
    value: 'Value',
    label: 'RadioButton',
    name: 'RadioButtonName',
    onChange: action('onChange'),
    size: 'md',
    viewType: 'edit',
  },
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputRadioButton',
      },
    },
  },
  args: {
    ...Main.args,
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
