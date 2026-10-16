import React from 'react';
import { List, ListItem } from '@mui/material';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Button, Grid, Link, Severity } from '@/components/atoms';

import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Molecules/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    isDisableStyleAlertText: { control: 'boolean' },
    expandable: { control: 'boolean' },
    isOpen: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Alert>;

const Content = ({ severity, hasList }: { severity: Severity; hasList?: boolean }) => (
  <Grid item container rowGap={2}>
    <Grid item container>
      Добавление холдинга в разработке. Для корректного отображения Клиента необходимо заводить сделку на головную
      компанию, либо другую компанию группы
    </Grid>

    {hasList && (
      <List disablePadding dense>
        <ListItem disableGutters>1. 16138078790870</ListItem>
        <ListItem disableGutters>2. 23242345325</ListItem>
        <ListItem disableGutters>3. 523524536t334</ListItem>
        <ListItem disableGutters>4. 4234325235345</ListItem>
      </List>
    )}
    <Grid item container>
      <Link
        severity={severity}
        dataTestId={'BaseExpandableAlert'}
        onClick={() => console.log('Click on link')}
        size={'sm'}
      >
        Link
      </Link>
    </Grid>
  </Grid>
);

const MainComponentOptionsTemplate = (args) => (
  <Grid container item spacing={4}>
    <Alert dataTestId={'BaseExpandableAlert'} severity={'warning'} title={'Функционал в разработке'}>
      <Content severity={'warning'} hasList />
    </Alert>

    <Alert
      dataTestId={'BaseClosableAlert'}
      severity={'error'}
      expandable={false}
      onClose={() => console.log('Alert has been closed')}
    >
      <Content severity={'error'} />
    </Alert>

    <Alert
      dataTestId={'CollapsedAlertWithButton'}
      severity={'success'}
      title={'Функционал в разработке'}
      expandable={false}
      actions={
        <Button
          color={'success'}
          type={'outlined'}
          dataTestId={'CollapsedAlertWithButton'}
          onClick={() => console.log('Click on button')}
          size={'sm'}
        >
          Применить
        </Button>
      }
    />
    <Alert
      dataTestId={'ExpandedAlertWithButton'}
      severity={'info'}
      title={'Функционал в разработке'}
      isOpen
      expandable={false}
      actions={
        <Button
          color={'info'}
          type={'outlined'}
          dataTestId={'ExpandedAlertWithButton'}
          onClick={() => console.log('Click on button')}
          size={'sm'}
        >
          Применить
        </Button>
      }
    >
      <Content severity={'info'} />
    </Alert>

    <Alert dataTestId={'ExpandedAlert'} severity={'warning'} title={'Функционал в разработке'} expandable={false}>
      <Content severity={'warning'} />
    </Alert>

    <Alert
      dataTestId={'ExpandableAndClosableAlert'}
      severity={'error'}
      title={'Функционал в разработке'}
      onClose={() => console.log('Alert has been closed')}
    >
      <Content severity={'error'} hasList />
    </Alert>

    <Alert
      dataTestId={'CollapsedAlertWithButtons'}
      severity={'info'}
      title={'Функционал в разработке'}
      expandable={false}
      actions={
        <>
          <Button
            color={'info'}
            type={'transparent'}
            dataTestId={'CollapsedAlertWithButtons'}
            onClick={() => console.log('Click on button')}
            size={'sm'}
          >
            Не применять
          </Button>

          <Button
            color={'info'}
            type={'outlined'}
            dataTestId={'CollapsedAlertWithButtons'}
            onClick={() => console.log('Click on button')}
            size={'sm'}
          >
            Применить
          </Button>
        </>
      }
    />
  </Grid>
);

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Alert',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    children: (
      <Grid item container rowGap={2}>
        <Grid item container>
          Добавление холдинга в разработке. Для корректного отображения Клиента необходимо заводить сделку на головную
          компанию, либо другую компанию группы
        </Grid>

        <List disablePadding dense>
          <ListItem disableGutters>1. 16138078790870</ListItem>
          <ListItem disableGutters>2. 23242345325</ListItem>
          <ListItem disableGutters>3. 523524536t334</ListItem>
          <ListItem disableGutters>4. 4234325235345</ListItem>
        </List>
      </Grid>
    ),
    severity: 'success',
    title: 'Функционал в разработке',
    isDisableStyleAlertText: false,
    expandable: true,
    isOpen: false,
    onClose: action('onClose'),
  },
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения Alert',
      },
    },
  },
  args: {
    ...Main.args,
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
