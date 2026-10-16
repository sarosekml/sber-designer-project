import React from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { IconButton } from '@/components/atoms/IconButton';
import { Link } from '@/components/atoms/Link';

import { ProductRow } from './ProductRow';
import { ProductRowProps } from './ProductRows.types';

export default {
  title: 'Molecules/ProductRow',
  component: ProductRow,
  argTypes: {
    dataTestId: {
      description: 'ProductRow',
    },
    hasSpot: {
      control: false,
    },
  },
} as Meta<typeof ProductRow>;

const Template: StoryFn<typeof ProductRow> = (args) => <ProductRow {...args} />;
export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  title: '1.1.1.1 Название инструмента',
  titlePostfix: (
    <>
      <Link to={'#'} dataTestId={'link'} size={'lg'}>
        Заполнить
      </Link>
      <Link to={'#'} dataTestId={'link'} size={'lg'}>
        Другое
      </Link>
    </>
  ),
  actions: (
    <>
      <IconButton name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
      <IconButton name={'DragDots'} dataTestId={'touch'} size={'lg'} />
    </>
  ),
  identData: {
    amount: '0.4',
    date: '2024-12-12',
    currency: 'RUB',
    amountTooltip: 'Сумма лимита',
    dateTooltip: 'Дата подписания',
  },
};

//# Flat

const flatArgs: ProductRowProps = {
  dataTestId: 'stories',
  title: '1.1.1.1 Название инструмента',
  variant: 'flat',
  disabled: false,
  titlePostfix: <IconButton name={'Star'} dataTestId={'IsMainDidPro'} size={'lg'} />,
  actions: (
    <>
      <IconButton name={'ChevronDown'} dataTestId={'keyboardArrowDown'} size={'lg'} />
      <IconButton name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
    </>
  ),
};

const titleActionDisabledFlat: Partial<ProductRowProps> = {
  disabled: true,
  titlePostfix: <IconButton disabled name={'Star'} dataTestId={'IsMainDidPro'} size={'lg'} />,
  actions: (
    <>
      <IconButton name={'ChevronDown'} dataTestId={'keyboardArrowDown'} size={'lg'} />
      <IconButton disabled name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
    </>
  ),
};

//## Flat Default

export const Flat = Template.bind({});
Flat.args = flatArgs;

//## Flat Default Disabled

export const FlatDisabled = Template.bind({ Flat });
FlatDisabled.args = { ...flatArgs, ...titleActionDisabledFlat };

//# Bordered

const borderedArgs: ProductRowProps = {
  dataTestId: 'stories',
  title: '1.1.1.1 Предпенсионные платежные',
  variant: 'bordered',
  titlePostfix: (
    <Link to={'#'} dataTestId={'link'} size={'lg'}>
      Заполнить
    </Link>
  ),
  actions: (
    <>
      <IconButton name={'InfoCircle'} dataTestId={'info'} size={'lg'} />
      <IconButton name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
      <IconButton name={'DragDots'} dataTestId={'touch'} size={'lg'} />
    </>
  ),
};

const titleActionDisabledBordered = {
  disabled: true,
  titlePostfix: (
    <Link disabled to={'#'} dataTestId={'link'} size={'lg'}>
      Заполнить
    </Link>
  ),
  actions: (
    <>
      <IconButton name={'InfoCircle'} dataTestId={'info'} size={'lg'} />
      <IconButton disabled name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
      <IconButton disabled name={'DragDots'} dataTestId={'touch'} size={'lg'} />
    </>
  ),
};

//## Bordered default

export const Bordered = Template.bind({});
Bordered.args = borderedArgs;

//## Bordered disabled

export const BorderedDisabled = Template.bind({});
BorderedDisabled.args = { ...borderedArgs, ...titleActionDisabledBordered };

//## Bordered error

export const BorderedError = Template.bind({});
BorderedError.args = { ...borderedArgs, error: true };

//## Bordered long title

export const BorderedLongTitle = Template.bind({});
BorderedLongTitle.args = {
  ...borderedArgs,
  title: '1.1.1.1 Предпенсионные платежные поручительства по внешнему долгу с множественными выплатами',
};

//## Product Row With Spot

const rowWithSpotArgs: ProductRowProps = {
  dataTestId: 'stories',
  title: '1.1.1.1 Название инструмента',
  variant: 'flat',
  disabled: false,
  titlePostfix: <IconButton name={'Star'} dataTestId={'IsMainDidPro'} size={'lg'} />,
  actions: (
    <>
      <IconButton name={'ChevronDown'} dataTestId={'keyboardArrowDown'} size={'lg'} />
      <IconButton name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
    </>
  ),
  hasSpot: true,
  onDoubleClick: () => console.log('CLICKED!'),
};

export const ProductRowWithSpot = Template.bind({});
ProductRowWithSpot.args = rowWithSpotArgs;

//## ProductDID

const productDIDArgs: ProductRowProps = {
  dataTestId: 'productDid',
  title: '1.1.1.1. Дополнительная доходность',
  variant: 'flat',
  disabled: false,
  subtitle: 'Дата факт. погашения  12.01.2021',
  titlePostfix: <IconButton name={'Star'} dataTestId={'IsMainDidPro'} size={'lg'} />,
  actions: (
    <>
      <IconButton name={'ChevronDown'} dataTestId={'keyboardArrowDown'} size={'lg'} />
      <IconButton name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
    </>
  ),
  identData: {
    amount: '0.4',
    date: '2024-12-12',
    currency: 'RUB',
    amountTooltip: 'Сумма лимита',
    dateTooltip: 'Дата подписания',
  },
  hasSpot: true,
};

export const ProductDID = Template.bind({});
ProductDID.args = productDIDArgs;

//## ProductDID disabled

const titleActionDisabledProductDid = {
  disabled: true,
  titlePostfix: <IconButton disabled name={'Star'} dataTestId={'IsMainDidPro'} size={'lg'} />,
  actions: (
    <>
      <IconButton disabled name={'ChevronDown'} dataTestId={'keyboardArrowDown'} size={'lg'} />
      <IconButton disabled name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
    </>
  ),
};

export const ProductDidDisabled = Template.bind({});
ProductDidDisabled.args = { ...productDIDArgs, ...titleActionDisabledProductDid };

//## ProductDid without subtitle

export const ProductDidWithoutSubtitle = Template.bind({});
ProductDidWithoutSubtitle.args = { ...productDIDArgs, subtitle: '' };

//## Instrument

const instrumentArgs: ProductRowProps = {
  dataTestId: 'instrument',
  title: '1.1.1.1. Проектный бридж в коммерческой недвижимости',
  variant: 'bordered',
  disabled: false,
  subtitle: 'Дата факт. погашения  12.01.2021',
  titlePostfix: (
    <Link to={'#'} dataTestId={'link'} size={'lg'}>
      Заполнить
    </Link>
  ),
  actions: (
    <>
      <IconButton name={'InfoCircle'} dataTestId={'info'} size={'lg'} />
      <IconButton name={'MinusCircle'} dataTestId={'delete'} size={'lg'} />
      <IconButton name={'DragDots'} dataTestId={'touch'} size={'lg'} />
    </>
  ),
  hasSpot: true,
};

export const instrument = Template.bind({});
instrument.args = instrumentArgs;

//## Instrument disabled

const titleActionDisabledInstrument = {
  disabled: true,
  titlePostfix: (
    <Link to={'#'} dataTestId={'link'} size="lg">
      Заполнить
    </Link>
  ),
  actions: (
    <>
      <IconButton name={'InfoCircle'} disabled dataTestId={'info'} size={'lg'} />
      <IconButton name={'MinusCircle'} disabled dataTestId={'delete'} size={'lg'} />
      <IconButton name={'DragDots'} disabled dataTestId={'touch'} size={'lg'} />
    </>
  ),
};

export const instrumentDisabled = Template.bind({});
instrumentDisabled.args = { ...instrumentArgs, ...titleActionDisabledInstrument };

//## Instrument without subtitle

export const instrumentWithoutSubtitle = Template.bind({});
instrumentWithoutSubtitle.args = { ...instrumentArgs, subtitle: '' };

//## Instrument error

export const instrumentError = Template.bind({});
instrumentError.args = { ...instrumentArgs, error: true };

//? УБрать заливнку кроме ховера
//? Цвет маленькой иконки
//? Иконка уголка
//? Заполнить ( линка) - размер м нужен (т.е LG по дизайну)
//? без даты погашения без галки
//? Галка текст 4 px
//точка текст 4px
