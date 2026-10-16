import React from 'react';
import { Theme, useTheme } from '@mui/material';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Button, Grid, IconButton, Link, Text, ValueBadge } from '@/components/atoms';
import { Alert } from '@/components/molecules';

import { InputDate } from '../../Inputs';

import { markerColors } from './TileCard/TileCard.const';
import { Tile } from './Tile';

const meta: Meta<typeof Tile> = {
  title: 'Molecules/Tiles/Tile',
  component: Tile,
  tags: ['autodocs'],
  parameters: {
    backgrounds: {
      default: 'whitesmoke',
      values: [{ name: 'whitesmoke', value: 'whitesmoke' }],
    },
  },
  args: {
    dataTestId: 'stories',
    isHighlighted: false,
    headless: false,
    hasSpot: false,
  },
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    isHighlighted: { control: { type: 'boolean' } },
    headless: { control: { type: 'boolean' } },
    hasSpot: { control: { type: 'boolean' } },
  },
};
export default meta;
type Story = StoryObj<typeof Tile>;

const TileSizeSTemplate = () => {
  const theme = useTheme<Theme>();

  return (
    <Grid container spacing={4} padding={2}>
      <Tile
        title={'114-3-1.1. Транш'}
        titlePostfix={
          <Grid item container>
            <Grid item>
              <ValueBadge
                component={'Marker'}
                value={'Изменен'}
                dataTestId={'Marker'}
                size={'sm'}
                colorThemeSx={{ textColor: markerColors.infoBlue }}
              />
            </Grid>
          </Grid>
        }
        size={'sm'}
        variant={'outlined'}
        dataTestId={'stories'}
        gridSizes={{ xs: 10 }}
      >
        <Grid item container columnSpacing={4} rowGap={4} flexDirection={'row'}>
          <Grid item xs>
            <Grid item xs>
              <Text dataTestId="stories" type="BodySReg" color={theme.palette.Text.TextSecondary}>
                Изменения требующие пересчета
              </Text>
            </Grid>
            <Grid item xs>
              <Link dataTestId="stories" onClick={() => {}} to="#">
                Выдачи и погашения
              </Link>
            </Grid>
          </Grid>

          <Grid item xs>
            <Grid item xs>
              <Text dataTestId="stories" type="BodySReg" color={theme.palette.Text.TextSecondary}>
                Изменения требующие пересчета
              </Text>
            </Grid>
            <Grid item xs>
              <Link dataTestId="stories" onClick={() => {}} to="#">
                Условия по досрочному погашению
              </Link>
            </Grid>
            <Grid item xs>
              <Link dataTestId="stories" onClick={() => {}} to="#">
                Платежи от контрагента
              </Link>
            </Grid>
          </Grid>
        </Grid>
      </Tile>
    </Grid>
  );
};

const TileSizeMTemplate = () => (
  <Grid container spacing={4} padding={2}>
    <Tile
      title={'Проектное финансирование'}
      subtitlePostfix={
        <Grid item container columnGap={1}>
          <Grid item>
            <ValueBadge component={'Marker'} value={'Погашен'} dataTestId={'Marker'} size={'sm'} />
          </Grid>
          <Grid item>
            <ValueBadge component={'Marker'} value={'Погашен'} dataTestId={'Marker'} size={'sm'} />
          </Grid>
          <Grid item>
            <ValueBadge component={'Marker'} value={'Погашен'} dataTestId={'Marker'} size={'sm'} />
          </Grid>
        </Grid>
      }
      size={'md'}
      variant={'outlined'}
      dataTestId={'stories'}
      gridSizes={{ xs: 6 }}
      actions={
        <>
          <IconButton name={'MinusCircle'} dataTestId={'Delete'} size={'md'} />
          <IconButton name={'ChevronRight'} dataTestId={'Forward'} size={'md'} />
        </>
      }
    >
      <Grid item container columnSpacing={4}>
        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Объем по продукту, млн ед.'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>

        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Валовая маржа, %'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>
      </Grid>
    </Tile>

    <Tile
      titlePostfix={
        <Grid item container columnGap={1}>
          <ValueBadge component={'Marker'} value={'Погашен'} dataTestId={'Marker'} size={'sm'} />

          <ValueBadge component={'Marker'} value={'Погашен'} dataTestId={'Marker'} size={'sm'} />

          <ValueBadge component={'Marker'} value={'Погашен'} dataTestId={'Marker'} size={'sm'} />
        </Grid>
      }
      size={'md'}
      variant={'outlined'}
      dataTestId={'stories'}
      gridSizes={{ xs: 6 }}
      actions={
        <>
          <IconButton name={'MinusCircle'} dataTestId={'Delete'} size={'md'} />
          <IconButton name={'ChevronRight'} dataTestId={'Forward'} size={'md'} />
        </>
      }
    >
      <Grid item container columnSpacing={4}>
        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Объем по продукту, млн ед.'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>

        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Валовая маржа, %'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>
      </Grid>
    </Tile>
  </Grid>
);

const TileSizeLTemplate = () => (
  <Grid container spacing={4} padding={2}>
    <Tile
      title={'Сроки сделки'}
      dataTestId={'stories'}
      gridSizes={{ xs: 6 }}
      actions={<IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />}
    >
      <Grid item container columnSpacing={4}>
        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата подписания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>

        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата окончания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>
      </Grid>
    </Tile>

    <Tile
      title={'Сроки сделки'}
      dataTestId={'stories'}
      gridSizes={{ xs: 6 }}
      actions={<IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />}
      alert={<Alert severity={'warning'} dataTestId={'stories'} title={'Функционал в разработке'} expandable={false} />}
    >
      <Grid item container columnSpacing={4}>
        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата подписания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>

        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата окончания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>
      </Grid>
    </Tile>

    <Tile
      title={'Сроки сделки'}
      dataTestId={'stories'}
      gridSizes={{ xs: 6 }}
      actions={<IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />}
    >
      <Grid item container columnSpacing={4} rowGap={6}>
        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата подписания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>

        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата окончания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>
        <Grid item>
          <Button dataTestId={'stories'} startIcon={'Star'} endIcon={'Star'} size={'sm'}>
            Применить
          </Button>
        </Grid>
      </Grid>
    </Tile>
  </Grid>
);

const TileHeadlessTemplate = () => (
  <Grid container spacing={4} padding={2}>
    <Tile headless dataTestId={'stories'} gridSizes={{ xs: 6 }}>
      <Grid item container columnSpacing={4}>
        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата подписания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>

        <Grid item xs={6}>
          <InputDate
            name={'Date'}
            label={'Дата окончания'}
            value={'2022-07-26'}
            viewType={'read'}
            onChange={() => console.log('Date change')}
            size={'lg'}
          />
        </Grid>
      </Grid>
    </Tile>
  </Grid>
);

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение Tile',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    gridSizes: { xs: 12 },
    title: 'Tile title',
    subtitle: 'Tile subtitle',
    children: 'Tile content',
    titlePostfix: <ValueBadge component={'Marker'} value={'TitlePostfix'} dataTestId={'Marker'} size={'sm'} />,
    actions: (
      <>
        <IconButton name={'Edit'} dataTestId={'Edit'} />
        <IconButton name={'MinusCircle'} dataTestId={'Delete'} />
      </>
    ),
  },
};

export const TileSizeS: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Tile S размера',
      },
    },
  },
  render: () => <TileSizeSTemplate />,
};

export const TileSizeM: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Tile M размера',
      },
    },
  },
  render: () => <TileSizeMTemplate />,
};

export const TileSizeL: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Tile L размера',
      },
    },
  },
  render: () => <TileSizeLTemplate />,
};

export const TileHeadless: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Tile headless',
      },
    },
  },
  render: () => <TileHeadlessTemplate />,
};

export const ActiveTile: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение активного Tile',
      },
    },
  },
  args: {
    gridSizes: { xs: 12 },
    dataTestId: 'stories',
    title: 'Tile title',
    subtitle: 'Tile subtitle',
    children: 'Tile content',
    variant: 'outlined',
    onDoubleClick: action('onDoubleClick'),
    isHighlighted: true,
    size: 'md',
  },
};

export const TileWithSpot: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение Tile со spot',
      },
    },
  },
  args: {
    ...ActiveTile.args,
    titlePostfix: <ValueBadge component={'Marker'} value={'TitlePostfix'} dataTestId={'Marker'} size={'sm'} />,
    actions: (
      <>
        <IconButton name={'Edit'} dataTestId={'Edit'} />
        <IconButton name={'MinusCircle'} dataTestId={'Delete'} />
      </>
    ),
    hasSpot: true,
  },
};
