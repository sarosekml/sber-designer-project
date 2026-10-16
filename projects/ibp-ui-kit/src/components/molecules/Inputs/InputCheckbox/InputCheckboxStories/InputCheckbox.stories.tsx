import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';

import { Grid, Text } from '@/index';

import { InputCheckbox } from '../InputCheckbox';

const meta: Meta<typeof InputCheckbox> = {
  title: 'Molecules/Inputs/InputCheckbox/InputCheckbox',
  component: InputCheckbox,
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
    indeterminate: { control: 'boolean' },
    helperText: { control: 'text' },
    id: { control: 'text' },
    label: { control: 'text' },
    name: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputCheckbox>;

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
        <Grid item xs={12}>
          <Text type={'H4StrongSmb'}>Unselected</Text>
        </Grid>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Default</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked={false} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked={false} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked={false} size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} disabled size={'sm'} />
        </Grid>
      </Grid>
      {/** Readonly view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} viewType={'read'} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} viewType={'read'} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} viewType={'read'} size={'sm'} />
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
          <InputCheckbox {...args} checked size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked disabled size={'sm'} />
        </Grid>
      </Grid>
      {/** Readonly view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked={true} viewType={'read'} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked={true} viewType={'read'} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} checked={true} viewType={'read'} size={'sm'} />
        </Grid>
      </Grid>

      {/** Indeterminate */}
      {/** Default view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={12}>
          <Text type={'H4StrongSmb'}>Selected</Text>
        </Grid>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Default</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate size={'sm'} />
        </Grid>
      </Grid>
      {/** Disable view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Disabled</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate disabled size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate disabled size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate disabled size={'sm'} />
        </Grid>
      </Grid>
      {/** Readonly view */}
      <Grid container item display={'flex'} alignItems={'center'} xs={12} padding={2} spacing={4}>
        <Grid item xs={3}>
          <Text type={'H4Reg'}>Readonly</Text>
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate viewType={'read'} size={'lg'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate viewType={'read'} size={'md'} />
        </Grid>
        <Grid item xs={3}>
          <InputCheckbox {...args} indeterminate viewType={'read'} size={'sm'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputCheckbox',
      },
    },
  },
  args: {
    checked: false,
    dataTestId: 'stories',
    disabled: false,
    helperText: 'Helper text',
    id: '12345',
    indeterminate: false,
    inputRef: undefined,
    label: 'Checkbox',
    name: 'CheckHappy',
    onChange: action('onClick'),
    size: 'md',
    viewType: 'edit',
  },
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты использования InputCheckbox',
      },
    },
  },
  args: {
    ...Main.args,
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
