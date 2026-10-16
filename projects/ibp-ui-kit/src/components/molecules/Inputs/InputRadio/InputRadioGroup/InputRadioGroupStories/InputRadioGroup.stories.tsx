import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';

import { Grid, Text } from '@/index';

import { InputRadioGroup } from '../InputRadioGroup';

const meta: Meta<typeof InputRadioGroup> = {
  title: 'Molecules/Inputs/InputRadioButton/InputRadioGroup/InputRadioGroup',
  component: InputRadioGroup,
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
    orientation: {
      options: ['vertical', 'horizontal'],
      control: { type: 'radio' },
    },
    title: { control: 'text' },
    name: { control: 'text' },
    value: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputRadioGroup>;

const VerticalViewTemplate = (args) => {
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
          <Text type={'H4StrongSmb'}>Vertical</Text>
        </Grid>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Default</Text>
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled</Text>
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} disabled size={'sm'} />
        </Grid>
      </Grid>
      {/** Readonly view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} viewType={'read'} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} viewType={'read'} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputRadioGroup {...args} viewType={'read'} size={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

const HorizontalViewTemplate = (args) => {
  return (
    <Grid container spacing={6}>
      {/** Horizontal */}
      {/** Lg view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Lg</Text>
        </Grid>
        <Grid item xs={9}>
          <InputRadioGroup {...args} size={'lg'} />
        </Grid>
      </Grid>
      {/** Md view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Md</Text>
        </Grid>
        <Grid item xs={9}>
          <InputRadioGroup {...args} size={'md'} />
        </Grid>
      </Grid>
      {/** Sm view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Sm</Text>
        </Grid>
        <Grid item xs={9}>
          <InputRadioGroup {...args} size={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  args: {
    title: 'Заголовок группы',
    dataTestId: 'InputRadioGroup',
    name: 'RadioGroup',
    size: 'md',
    viewType: 'edit',
    orientation: 'vertical',
    disabled: false,
    onChange: action('onChange'),
    list: [
      {
        label: 'Вариант 1',
        value: 'radioButtonValue1',
        helperText: 'Дополнительный текст',
      },
      {
        label: 'Вариант 2',
        value: 'radioButtonValue2',
        helperText: 'Дополнительный текст',
      },
      {
        label: 'Вариант 3',
        value: 'radioButtonValue3',
        helperText: 'Дополнительный текст',
      },
    ],
  },
};

export const Vertical_view: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Вертикальное отображение InputRadioGroup',
      },
    },
  },
  args: {
    ...Main.args,
  },
  render: (args) => <VerticalViewTemplate {...args} />,
};

export const Horizontal_view: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Горизонтальное отображение InputRadioGroup',
      },
    },
  },
  args: {
    ...Main.args,
    orientation: 'horizontal',
  },
  render: (args) => <HorizontalViewTemplate {...args} />,
};
