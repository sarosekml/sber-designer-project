/* eslint-disable react/no-unescaped-entities */
import React from 'react';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

import { Button, Grid, Icon, Page, SxBox } from '@/components/atoms';

import { ErrorBanner } from './ErrorBanner';

const meta: Meta<typeof ErrorBanner> = {
  title: 'Molecules/Errors/ErrorBanner',
  component: ErrorBanner,
  tags: ['autodocs'],
  parameters: {
    default: 'light swamp',
  },
  argTypes: {
    title: { control: 'text' },
    message: { control: 'text' },
    actions: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof ErrorBanner>;

const Actions = () => (
  <Grid item container spacing={2}>
    <Grid item>
      <Button dataTestId={'primary'}>Покаяться</Button>
    </Grid>
    <Grid item>
      <Button dataTestId={'secondary'} type={'outlined'}>
        Показать жест
      </Button>
    </Grid>
  </Grid>
);

const Action = () => (
  <Grid item container spacing={2} justifyContent={'center'}>
    <Grid item>
      <Button dataTestId={'primary'} startIcon="ClientSearch">
        Добавить клиента
      </Button>
    </Grid>
  </Grid>
);

const MainTemplate: StoryFn<typeof ErrorBanner> = (args) => {
  return (
    <Page dataTestId={'Error'}>
      <ErrorBanner {...args} actions={args.actions && args.isImageOnTop ? <Action /> : <Actions />} />
    </Page>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение ErrorBanner',
      },
    },
  },
  args: {
    message: 'Какой-то сопровождающий текст ошибки',
    actions: true,
  },
  render: (args) => <MainTemplate {...args} />,
};

export const ImageOnTop: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Banner с сообщением об отсутствии данных',
      },
    },
  },
  args: {
    title: 'Здесь пока ничего нет',
    message: (
      <SxBox
        component="span"
        display="inline-block"
        whiteSpace="normal"
        maxWidth={480}
        sx={(theme) => ({
          color: theme.palette.Text.TextSecondary,
          textAlign: 'center',
        })}
      >
        Выберете клиента через поиск и добавьте в список "Мои клиенты" с помощью кнопки
        <Icon
          name="BookmarkAdd"
          color="#639994"
          sx={{
            display: 'inline-flex',
            verticalAlign: 'middle',
            ml: 1,
          }}
        />
      </SxBox>
    ),
    actions: true,
    isImageOnTop: true,
    reason: 'NothingHereYet',
  },
  render: (args) => <MainTemplate {...args} />,
};
