import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { ProductButton } from './ProductButton';

export default {
  title: 'Atoms/Buttons/ProductButton',
  component: ProductButton,
  argTypes: {
    dataTestId: {
      description: 'ProductButton',
    },
  },
} as Meta;

const Template: StoryFn<typeof ProductButton> = (args) => <ProductButton {...args} />;

export const AMain = Template.bind({});
AMain.args = {
  dataTestId: 'ProductButton',
  children: 'Добавить продукт',
  onClick: () => console.log('Clicked'),
  disabled: false,
};

export const BDisabled = Template.bind({});
BDisabled.args = {
  dataTestId: 'ProductButton',
  children: 'Добавить продукт',
  disabled: true,
};
