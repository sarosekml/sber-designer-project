import React from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid, Icon, IconButton, Text } from '@/components/atoms';
import { theme } from '@/styles';

import { BaseCard } from './Card';

const textColor = theme.palette.Text.TextPrimary;
const headerIconColor = theme.palette.Tertiary.TertiaryDark;
const fullSize = { xs: 12 };

const meta: Meta<typeof BaseCard> = {
  title: 'Molecules/Card',
  component: BaseCard,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    disabled: { control: 'boolean' },
    selected: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof BaseCard>;

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение BaseCard',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    title: 'Card Company',
    subtitle: 'Card Company subtitle',
    extra: <IconButton name={'Edit'} dataTestId={'Edit'} />,
    children: (
      <Grid container item spacing={2} sizes={fullSize}>
        <Grid item sizes={fullSize}>
          <Text color={textColor} type="BodySReg" dataTestId={'text'}>
            ИНН
          </Text>
        </Grid>
        <Grid item sizes={fullSize}>
          <Text color={textColor} type="BodySReg" dataTestId={'text'}>
            КПП
          </Text>
        </Grid>
        <Grid item sizes={fullSize}>
          <Text color={textColor} type="BodySReg" dataTestId={'text'}>
            ОГРН
          </Text>
        </Grid>
        <Grid item sizes={fullSize}>
          <Text color={textColor} type="BodySReg" dataTestId={'text'}>
            CRM ID
          </Text>
        </Grid>
        <Grid item sizes={fullSize}>
          <Text color={textColor} type="BodySReg" dataTestId={'text'}>
            КИО
          </Text>
        </Grid>
      </Grid>
    ),
    disabled: false,
    selected: false,
    onClick: action('onClick'),
    onDoubleClick: action('onDoubleClick'),
  },
};
export const WithHeaderIcon: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение с иконкой в заголовке',
      },
    },
  },
  args: {
    ...Main.args,
    headerIcon: <Icon name="Building02" color={headerIconColor} />,
  },
};
