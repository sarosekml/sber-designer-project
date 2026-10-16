import { Grid } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { Text } from '../../../atoms';
import { DictionaryList, DictionaryListItem, ValueList } from '../../DictionaryList';
import { InputTemplate } from './InputTemplate';
import { InputTemplateProps } from './InputTemplate.types';

export default {
  title: 'Molecules/InputTemplate',
  component: InputTemplate,
  argTypes: {
    value: { control: { disable: true }, table: { disable: false } },
    type: { control: { disable: true }, table: { disable: false } },
  },
} as Meta;

const props: Partial<InputTemplateProps> = {
  helperText: 'Test helper message',
  label: 'Name',
  size: 'md',
};

const longTextValue =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Diam vel quam elementum pulvinar. Mattis rhoncus urna neque viverra justo. Elementum integer enim neque volutpat ac tincidunt vitae. Viverra maecenas accumsan lacus vel facilisis. Dui sapien eget mi proin sed libero enim sed faucibus. Nisi lacus sed viverra tellus. Orci nulla pellentesque dignissim enim sit amet venenatis urna. Sed adipiscing diam donec adipiscing tristique risus nec. Amet venenatis urna cursus eget. Urna et pharetra pharetra massa massa ultricies. In cursus turpis massa tincidunt dui ut. Ut tristique et egestas quis ipsum suspendisse ultrices.';

const valueListData: string[] = [
  'Черновик',
  'Черновик',
  'Черновик',
  'Очень длинный черновик, который не влезает в длину строки',
];

const dictionaryListData: DictionaryListItem[] = [
  {
    code: 'Color 1',
    name: 'Color 1',
    colorThemeSx: {
      backgroundColor: 'red',
      textColor: 'white',
    },
  },
  {
    code: 'Color 2',
    name: 'Color 2',
    colorThemeSx: {
      backgroundColor: 'green',
      textColor: 'white',
    },
  },
  {
    code: 'Color 3',
    name: 'Color 3',
    colorThemeSx: {
      backgroundColor: 'blue',
      textColor: 'white',
    },
  },
];

const Template: StoryFn<typeof InputTemplate> = (args) => {
  return (
    <Grid container md={12} spacing={8}>
      <Grid item md={6}>
        <InputTemplate {...args}>Test value</InputTemplate>
      </Grid>
      <Grid item md={6}>
        <InputTemplate {...args}>12</InputTemplate>
      </Grid>
      <Grid item md={6}>
        <InputTemplate {...args}>{longTextValue}</InputTemplate>
      </Grid>
      <Grid item md={6}>
        <InputTemplate {...args}>
          <Text sx={{ textAlign: 'justify' }}>{longTextValue}</Text>
        </InputTemplate>
      </Grid>

      <Grid item md={3}>
        <InputTemplate {...args}>
          <ValueList data={valueListData} itemComponent="Chip" />
        </InputTemplate>
      </Grid>
      <Grid item md={3}>
        <InputTemplate {...args}>
          <ValueList data={valueListData} itemComponent="Marker" />
        </InputTemplate>
      </Grid>
      <Grid item md={3}>
        <InputTemplate {...args}>
          <ValueList data={valueListData} itemComponent="Chip" />
        </InputTemplate>
      </Grid>
      <Grid item md={3}>
        <InputTemplate {...args}>
          <ValueList data={valueListData} itemComponent="Marker" />
        </InputTemplate>
      </Grid>

      <Grid item md={6}>
        <InputTemplate {...args}>
          <ValueList data={valueListData} itemComponent="Chip" expandable={true} limit={2} />
        </InputTemplate>
      </Grid>
      <Grid item md={6}>
        <InputTemplate {...args}>
          <ValueList data={valueListData} itemComponent="Marker" expandable={true} limit={2} />
        </InputTemplate>
      </Grid>

      <Grid item md={6}>
        <InputTemplate {...args}>
          <DictionaryList data={dictionaryListData} itemComponent="Chip" expandable={true} />
        </InputTemplate>
      </Grid>
      <Grid item md={6}>
        <InputTemplate {...args}>
          <DictionaryList data={dictionaryListData} itemComponent="Marker" expandable={true} />
        </InputTemplate>
      </Grid>
    </Grid>
  );
};

export const InputTemplateText = Template.bind({});
InputTemplateText.args = { ...props };
