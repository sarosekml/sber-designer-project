import { StoryFn, Meta } from '@storybook/react';
import React from 'react';
import { Tab } from './Tab';

export default {
  title: 'Atoms/Tab',
  component: Tab,
  argTypes: {
    dataTestId: { table: { disable: true } },
    classes: { table: { disable: true } },
    children: { table: { disable: true } },
    action: { table: { disable: true } },
    onFocusVisible: { table: { disable: true } },
    focusVisibleClassName: { table: { disable: true } },
    touchRippleProps: { table: { disable: true } },
    TouchRippleProps: { table: { disable: true } },
    touchRippleRef: { table: { disable: true } },
    onFocusRipple: { table: { disable: true } },
    icon: { table: { disable: true } },
    ref: { table: { disable: true } },
    disabled: { control: 'boolean' },
    centerRipple: { control: 'boolean' },
    disableRipple: { control: 'boolean' },
    disableTouchRipple: { control: 'boolean' },
    focusRipple: { control: 'boolean' },
    LinkComponent: { control: 'text' },
    disableFocusRipple: { control: 'boolean' },
    wrapped: { control: 'boolean' },
    tabIndex: { control: 'number' },
  },
} as Meta;

export const Main: StoryFn<typeof Tab> = (args) => <Tab {...args} />;

Main.args = {
  label: 'Test Label',
  value: '1',
  dataTestId: 'stories',
  size: 'md',
  iconValue: 2,
};
