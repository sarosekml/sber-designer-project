import React from 'react';
import { Meta, StoryFn, StoryObj } from '@storybook/react';

import { Button, Grid, GridTileSection } from '@/components/atoms';

import { Tile } from '../../Tiles/Tile';

import { ErrorSection } from './ErrorSection';

const meta: Meta<typeof ErrorSection> = {
  title: 'Molecules/Errors/ErrorSection',
  component: ErrorSection,
  tags: ['autodocs'],
  parameters: {
    default: 'light',
  },
  argTypes: {
    message: { control: 'text' },
    title: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof ErrorSection>;

const MainComponentOptionsTemplate = (args) => (
  <GridTileSection dataTestId={'lsdfjdslkf'} sizes={{ xs: 12 }}>
    <Tile dataTestId={'dfskl'} title={'Падение сервера'} gridSizes={{ md: 4 }}>
      <ErrorSection {...args} reason={'ServerFail'} />
    </Tile>
    <Tile dataTestId={'dfskl'} title={'Нет доступа'} gridSizes={{ xs: 4 }}>
      <ErrorSection {...args} reason={'Forbidden'} />
    </Tile>

    <Tile dataTestId={'dfskl'} title={'Не найден'} gridSizes={{ xs: 4 }}>
      <ErrorSection {...args} reason={'NotFound'} />
    </Tile>

    <Tile dataTestId={'dfskl'} title={'Нет доступа'} gridSizes={{ xs: 4 }}>
      <ErrorSection {...args} reason={'Forbidden'} />
    </Tile>
    <Tile dataTestId={'dfskl'} title={'Не найден'} gridSizes={{ xs: 4 }}>
      <ErrorSection {...args} reason={'NotFound'} />
    </Tile>
    <Tile dataTestId={'dfskl'} title={'Падение сервера'} gridSizes={{ md: 4 }}>
      <ErrorSection {...args} reason={'ServerFail'} />
    </Tile>

    <Tile dataTestId={'dfskl'} title={'Нет доступа'} gridSizes={{ xs: 6 }}>
      <ErrorSection {...args} reason={'Forbidden'} />
    </Tile>
    <Tile dataTestId={'dfskl'} title={'Не найден'} gridSizes={{ xs: 6 }}>
      <ErrorSection {...args} reason={'NotFound'} />
    </Tile>

    <Tile dataTestId={'dfskl'} title={'Падение сервера'} gridSizes={{ xs: 12 }}>
      <ErrorSection {...args} reason={'ServerFail'} />
    </Tile>
    <Tile dataTestId={'dfskl'} title={'Нет доступа'} gridSizes={{ xs: 12 }}>
      <ErrorSection {...args} reason={'Forbidden'} actions={null} />
    </Tile>
    <Tile dataTestId={'dfskl'} title={'Не найден'} gridSizes={{ xs: 12 }}>
      <ErrorSection {...args} reason={'NotFound'} actions={null} message={undefined} />
    </Tile>
  </GridTileSection>
);

const CustomErrorSectionTemplate: StoryFn<typeof ErrorSection> = (args) => (
  <GridTileSection dataTestId={'lsdfjdslkf'} sizes={{ xs: 12 }}>
    <Tile dataTestId={'dfskl'} title={'Пентагон'} gridSizes={{ xs: 6 }}>
      <ErrorSection {...args} />
    </Tile>
  </GridTileSection>
);

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение ErrorSection',
      },
    },
  },
  args: {
    message: 'Какой-то сопровождающий текст ошибки',
  },
};
export const MainComponentOptions: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение ErrorBanner',
      },
    },
  },
  args: {
    message:
      'Пожалуйста, поднимите руки от клавиатуры и отойдите. Отряд прибудет через несколько минут. Постарайтесь ничего не запачкать',
    actions: (
      <Grid item container spacing={2}>
        <Grid item>
          <Button dataTestId={'primary'}>Сопротивляться</Button>
        </Grid>
        <Grid item>
          <Button dataTestId={'secondary'} type={'outlined'}>
            Смириться
          </Button>
        </Grid>
      </Grid>
    ),
  },
  render: (args) => <MainComponentOptionsTemplate {...args} />,
};

export const CustomErrorSection: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Варианты отображения Alert',
      },
    },
  },
  args: {
    reason: 'Forbidden',
    title: 'Абсолютное нарушение правил кибербезопасности',
    message: 'За вами уже никто не приедет. Оставайтесь на месте, смотрите на красную точку.\n3... 2... 1...',
    size: 'md',
    actions: (
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
    ),
  },
  render: (args) => <CustomErrorSectionTemplate {...args} />,
};
