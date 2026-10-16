import React from 'react';
import { Theme, useTheme } from '@mui/material';
import { Meta, StoryObj } from '@storybook/react';

import { Grid, IconButton, Link, Text } from '@/components/atoms';
import { Alert, ProductRow } from '@/components/molecules';

import { ValueBadge } from '../../../..';
import { InputText } from '../..';
import { Tile } from '../Tile';
import { markerColors } from '../Tile/TileCard/TileCard.const';

import { AccordionTile } from './AccordionTile';

const meta: Meta<typeof AccordionTile> = {
  title: 'Molecules/Tiles/AccordionTile',
  component: AccordionTile,
  tags: ['autodocs'],
  parameters: {
    backgrounds: {
      default: 'whitesmoke',
      values: [{ name: 'whitesmoke', value: 'whitesmoke' }],
    },
  },
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    accordionSummary: { control: 'text' },
    accordionContent: { control: 'text' },
    hasSpot: { control: 'boolean' },
    isExpanded: { control: 'boolean' },
    disabled: { control: 'boolean' },
    isDragAndDropContainer: { control: 'boolean' },
    subtitlePostfix: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof AccordionTile>;

const value = '-';

const TileAccordionSizeSTemplate = () => {
  const theme = useTheme<Theme>();

  return (
    <Grid container spacing={4}>
      <Tile headless dataTestId={'stories'} gridSizes={{ xs: 6 }}>
        <AccordionTile
          size={'sm'}
          dataTestId={'stories'}
          title={'1. Кредит'}
          accordionContent={
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
          }
        />
      </Tile>
    </Grid>
  );
};

const TileAccordionSizeMTemplate = () => (
  <Grid container spacing={4}>
    <AccordionTile
      size={'md'}
      dataTestId={'stories'}
      title={'1. Кредит'}
      accordionSummary={
        <Grid item container rowGap={4}>
          <InputText label={'Контрагент'} name={'stories'} value={value} viewType={'read'} />
          <Grid item container flexWrap={'nowrap'} columnGap={5}>
            <InputText label={'Баланс'} name={'stories'} value={value} viewType={'read'} />
            <InputText label={'Валюта расчетов'} name={'stories'} value={value} viewType={'read'} />
            <InputText label={'Тип отчетности'} name={'stories'} viewType={'read'} value={'Только МСФО'} />
            <InputText label={'FV/AC'} name={'stories'} value={value} viewType={'read'} />
          </Grid>
        </Grid>
      }
      accordionContent={
        <Grid item container rowGap={2}>
          <ProductRow
            title={'1.1.1. Договор займа'}
            dataTestId={'stories'}
            actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
          />
          <ProductRow
            title={'1.1.2. Договор займа (без линии)'}
            titlePostfix={<ValueBadge value={'Погашен'} dataTestId={'stories'} component="Marker" />}
            dataTestId={'stories'}
            actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
          />
        </Grid>
      }
      actions={<IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />}
    />

    <AccordionTile
      size={'md'}
      dataTestId={'stories'}
      title={'1. Кредит'}
      accordionSummary={
        <Grid item container rowGap={4}>
          <InputText label={'Контрагент'} name={'stories'} value={value} viewType={'read'} />
          <Grid item container flexWrap={'nowrap'} columnGap={5}>
            <InputText label={'Баланс'} name={'stories'} value={value} viewType={'read'} />
            <InputText label={'Валюта расчетов'} name={'stories'} value={value} viewType={'read'} />
            <InputText label={'Тип отчетности'} name={'stories'} viewType={'read'} value={'Только МСФО'} />
            <InputText label={'FV/AC'} name={'stories'} value={value} viewType={'read'} />
          </Grid>
        </Grid>
      }
      accordionContent={
        <Grid item container rowGap={2}>
          <ProductRow
            title={'1.1.1. Договор займа'}
            dataTestId={'stories'}
            actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
          />
          <ProductRow
            title={'1.1.2. Договор займа (без линии)'}
            titlePostfix={<ValueBadge value={'Погашен'} dataTestId={'stories'} component={'Marker'} />}
            dataTestId={'stories'}
            actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
          />
        </Grid>
      }
      actions={<IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />}
      isExpanded
      disabled
    />
  </Grid>
);

const TileAccordionWithAlertTemplate = () => (
  <Grid container spacing={4}>
    <AccordionTile
      size={'md'}
      dataTestId={'stories'}
      title={'1. Кредит'}
      accordionSummary={
        <Grid item container rowGap={4}>
          <InputText label={'Контрагент'} name={'stories'} value={value} viewType={'read'} />
          <Grid item container flexWrap={'nowrap'} columnGap={5}>
            <InputText label={'Баланс'} name={'stories'} value={value} viewType={'read'} />
            <InputText label={'Валюта расчетов'} name={'stories'} value={value} viewType={'read'} />
            <InputText label={'Тип отчетности'} name={'stories'} viewType={'read'} value={'Только МСФО'} />
            <InputText label={'FV/AC'} name={'stories'} value={value} viewType={'read'} />
          </Grid>
        </Grid>
      }
      accordionContent={
        <Grid item container rowGap={2}>
          <ProductRow
            title={'1.1.1. Договор займа'}
            dataTestId={'stories'}
            actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
          />
          <ProductRow
            title={'1.1.2. Договор займа (без линии)'}
            titlePostfix={<ValueBadge value={'Погашен'} dataTestId={'stories'} component={'Marker'} />}
            dataTestId={'stories'}
            actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
          />
        </Grid>
      }
      actions={<IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />}
      alert={<Alert severity={'warning'} dataTestId={'stories'} title={'Функционал в разработке'} expandable={false} />}
    />
  </Grid>
);

const TileAccordionSizeLTemplate = () => {
  const theme = useTheme<Theme>();

  return (
    <Grid container spacing={4}>
      <AccordionTile
        size={'lg'}
        dataTestId={'stories'}
        title={'1. Кредит'}
        accordionSummary={
          <Grid item container rowGap={4}>
            <InputText
              label={'Наименование финансового инструмента'}
              name={'stories'}
              value={'1. Кредит'}
              viewType={'read'}
            />
            <Grid item container rowGap={4}>
              <InputText
                label={'Контрагент'}
                name={'stories'}
                value={'КГ ГАЗНЕФТЕХИМПРОМСТРОЙ НЕДВИЖИМОСТЬ'}
                viewType={'read'}
              />
              <Grid item container flexWrap={'nowrap'} columnGap={5}>
                <InputText label={'Баланс'} name={'stories'} value={'SBI Voskhod Capital'} viewType={'read'} />
                <InputText label={'Валюта расчетов'} name={'stories'} value={'RUB'} viewType={'read'} />
                <InputText label={'Тип отчетности'} name={'stories'} viewType={'read'} value={'Только РСБУ'} />
                <InputText label={'FV/AC'} name={'stories'} value={'FV'} viewType={'read'} />
              </Grid>
            </Grid>
          </Grid>
        }
        accordionContent={
          <Grid item container rowGap={2}>
            <Tile
              title={'114-3-1.1. Транш'}
              titlePostfix={
                <Grid item container>
                  <Grid item>
                    <ValueBadge
                      value={'Изменен'}
                      dataTestId={'Marker'}
                      size={'sm'}
                      colorThemeSx={{ textColor: markerColors.infoBlue }}
                      component={'Marker'}
                    />
                  </Grid>
                </Grid>
              }
              size={'sm'}
              variant={'outlined'}
              dataTestId={'stories'}
              gridSizes={{ xs: 12 }}
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
            <ProductRow
              title={'114-3-1.2. Транш'}
              dataTestId={'stories'}
              disabled
              actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
            />
            <ProductRow
              title={'114-3-1.3. Транш'}
              dataTestId={'stories'}
              disabled
              actions={<IconButton name={'DragDots'} dataTestId={'stories'} />}
            />
          </Grid>
        }
        actions={
          <>
            <IconButton name={'Calendar'} dataTestId={'Calendar'} size={'lg'} />
            <IconButton name={'History'} dataTestId={'History'} size={'lg'} />
          </>
        }
      />
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение AccordionTile',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    gridSizes: { xs: 12 },
    title: 'Accordion tile title',
    subtitle: 'Accordion tile subtitle',
    accordionSummary: 'Accordion tile summary',
    accordionContent: 'Accordion tile content',
    titlePostfix: <ValueBadge value={'TitlePostfix'} dataTestId={'Marker'} size={'sm'} component={'Marker'} />,
    actions: <IconButton name={'Edit'} dataTestId={'Edit'} size={'lg'} />,
    isExpanded: false,
  },
};

export const TileAccordionSizeS: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение AccordionTile S размера',
      },
    },
  },
  render: () => <TileAccordionSizeSTemplate />,
};

export const TileAccordionSizeM: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение AccordionTile M размера',
      },
    },
  },
  render: () => <TileAccordionSizeMTemplate />,
};

export const TileAccordionSizeL: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение AccordionTile L размера',
      },
    },
  },
  render: () => <TileAccordionSizeLTemplate />,
};

export const TileAccordionWithAlert: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение AccordionTile с Alert',
      },
    },
  },
  render: () => <TileAccordionWithAlertTemplate />,
};

export const TileAccordionWithSpot: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Отображение AccordionTile со Spot',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    gridSizes: { xs: 12 },
    title: 'Accordion tile title',
    subtitle: 'Accordion tile subtitle',
    accordionSummary: 'Accordion tile summary',
    accordionContent: 'Accordion tile content',
    titlePostfix: <ValueBadge value={'TitlePostfix'} dataTestId={'Marker'} size={'sm'} component={'Marker'} />,
    actions: <IconButton name={'Edit'} dataTestId={'Edit'} />,
    hasSpot: true,
  },
};
