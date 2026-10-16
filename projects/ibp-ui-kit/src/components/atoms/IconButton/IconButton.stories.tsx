import React from 'react';
import { Grid } from '@mui/material';
import { useTheme } from '@mui/system';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Icon, Text } from '@/index';

import { IconButton } from './IconButton';
import { DraggableProvidedDragHandleProps } from './IconButton.types';

const meta: Meta<typeof IconButton> = {
  title: 'Atoms/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Кнопка-иконка',
      },
    },
  },
  argTypes: {
    disabled: {
      control: 'boolean',
    },
    color: {
      description: "It's possible to use colors: info, error, warning, success or any other colors",
      control: 'radio',
    },
    dataTestId: { table: { disable: true } },
    sx: { table: { disable: true } },
    ref: { table: { disable: true } },
  },
};
export default meta;
type Story = StoryObj<typeof IconButton>;

const draggableProps: DraggableProvidedDragHandleProps = {
  'data-rbd-drag-handle-draggable-id': '123',
  'data-rbd-drag-handle-context-id': '321',
  'aria-describedby': 'xyz',
  role: 'role',
  tabIndex: 1,
  draggable: true,
  onDragStart: (event) => console.log(event),
};

const AlternativeColorsTemplate = (args) => {
  const theme = useTheme();

  return (
    <Grid container spacing={2}>
      <Grid container>
        <Grid item xs={2}></Grid>
        <Grid item xs={2}>
          <Text>Info</Text>
        </Grid>
        <Grid item xs={2}>
          <Text>Error</Text>
        </Grid>
        <Grid item xs={2}>
          <Text>Warning</Text>
        </Grid>
        <Grid item xs={2}>
          <Text>Success</Text>
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={2}>
          <Text>Default</Text>
        </Grid>
        <Grid
          container
          item
          xs={2}
          justifyContent={'center'}
          alignItems={'center'}
          sx={{ height: '50px', backgroundColor: theme.palette.Info.InfoBG }}
        >
          <Icon {...args} color={'info'} />
        </Grid>
        <Grid
          container
          item
          xs={2}
          justifyContent={'center'}
          alignItems={'center'}
          sx={{ backgroundColor: theme.palette.Error.ErrorBG }}
        >
          <Icon {...args} color={'error'} />
        </Grid>
        <Grid
          container
          item
          xs={2}
          justifyContent={'center'}
          alignItems={'center'}
          sx={{ backgroundColor: theme.palette.Warning.WarningBG }}
        >
          <Icon {...args} color={'warning'} />
        </Grid>
        <Grid
          container
          item
          xs={2}
          justifyContent={'center'}
          alignItems={'center'}
          sx={{ backgroundColor: theme.palette.Success.SuccessBG }}
        >
          <Icon {...args} color={'success'} />
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={2}>
          <Text>Hover=Focus + Draggable</Text>
        </Grid>
        <Grid
          container
          item
          xs={2}
          justifyContent={'center'}
          alignItems={'center'}
          sx={{ height: '50px', backgroundColor: theme.palette.Info.InfoBG }}
        >
          <IconButton {...args} draggableProps={draggableProps} color={'info'} />
        </Grid>
        <Grid container item xs={2} justifyContent={'center'} sx={{ backgroundColor: theme.palette.Error.ErrorBG }}>
          <IconButton {...args} draggableProps={draggableProps} color={'error'} />
        </Grid>
        <Grid container item xs={2} justifyContent={'center'} sx={{ backgroundColor: theme.palette.Warning.WarningBG }}>
          <IconButton {...args} draggableProps={draggableProps} color={'warning'} />
        </Grid>
        <Grid container item xs={2} justifyContent={'center'} sx={{ backgroundColor: theme.palette.Success.SuccessBG }}>
          <IconButton {...args} draggableProps={draggableProps} color={'success'} />
        </Grid>
      </Grid>
    </Grid>
  );
};

const MainComponentOptionsTemplate = (args) => {
  return (
    <Grid container spacing={2}>
      <Grid container justifyContent={'center'}>
        <Grid item xs={3}></Grid>
        <Grid item xs={3}>
          <Text align={'center'}>L</Text>
        </Grid>
        <Grid item xs={3}>
          <Text align={'center'}>M</Text>
        </Grid>
        <Grid item xs={3}>
          <Text align={'center'}>S</Text>
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={3}>
          <Text>Default</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <IconButton {...args} size={'lg'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'}>
          <IconButton {...args} size={'md'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'}>
          <IconButton {...args} size={'sm'} />
        </Grid>
      </Grid>
      <Grid container>
        <Grid item xs={3}>
          <Text>Hover/Focus</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <IconButton {...args} size={'lg'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <IconButton {...args} size={'md'} />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <IconButton {...args} size={'sm'} />
        </Grid>
      </Grid>

      <Grid container>
        <Grid item xs={3}>
          <Text>Disabled</Text>
        </Grid>
        <Grid container item xs={3} justifyContent={'center'} alignItems={'center'} sx={{ height: '50px' }}>
          <IconButton {...args} size={'lg'} disabled />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <IconButton {...args} size={'md'} disabled />
        </Grid>
        <Grid container item xs={3} justifyContent={'center'}>
          <IconButton {...args} size={'sm'} disabled />
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение кнопки-иконки',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    name: 'Check',
    size: 'md',
    disabled: false,
    onClick: action('onClick'),
  },
};

export const AlternativeColors: Story = {
  parameters: {
    docs: {
      description: {
        story: `Для размещения на алертах и в карточках снэкбара<br>
          Для каждого типа алерта - свой вариант раскраски кнопок<br>
          Цвет рипла соответствует цвету иконки`,
      },
    },
  },
  args: {
    ...Main.args,
    name: 'Edit',
  },
  render: (args) => <AlternativeColorsTemplate {...args} />,
};

export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: `Мастер и варианты в одном компоненте<br>Цвет рипла соответствует цвету иконки`,
      },
    },
  },
  args: {
    ...Main.args,
    name: 'Edit',
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};
