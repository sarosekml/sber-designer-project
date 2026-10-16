import { Dictionary, IsoDate, Nullable } from '@sber-ibp/core';

import { gridSizes } from '@/utils/gridSizes';

import { FormDictionaryMap, FormTemplate } from './FormConstructor.types';
import {
  makeDateRangeObject,
  makeMultipleAutocompleteObject,
  makeMultipleAutocompleteOuterChipObject,
  makeNumberObject,
  makeNumberRangeObject,
  makeSingleAutocompleteObject,
  makeTextObject,
} from '.';

export interface DeskDictionary extends Dictionary {
  departmentCode: string;
}

export interface FormFields {
  departments: Dictionary[];
  desks: DeskDictionary[]; // autocomplete
  project: string; // text
  amount: number; // number
  price: {
    from: number;
    to: number;
  };
  creationDate: {
    from: IsoDate;
    to: IsoDate;
  };
  lastUpdate: string; // date
  branch: Dictionary; // autocomplete
  isActive: boolean; // checkbox
  currencies: Dictionary[]; // autocomplete
  kmStateTypes: Dictionary[];
}

export type FormData = Nullable<FormFields>;

export const defaultFilters: FormData = {
  amount: null,
  branch: null,
  creationDate: null,
  currencies: null,
  departments: null,
  desks: null,
  isActive: null,
  lastUpdate: null,
  price: null,
  project: null,
  kmStateTypes: null,
};

export const departmentsMock: Dictionary[] = [
  {
    code: '1',
    name: 'DID',
  },
  {
    code: '2',
    name: 'DDD',
  },
];

export const desksMock: DeskDictionary[] = [
  {
    code: 'SMB_TB',
    name: 'Центр экспертизы',
    departmentCode: '1',
  },
  {
    code: 'SMB_MANAGEMENT',
    name: 'SMB Менеджмент',
    departmentCode: '2',
  },
  {
    code: 'DID_CHANGE',
    name: 'ДИД Change',
    departmentCode: '1',
  },
];

export const branchesMock: Dictionary[] = [
  {
    code: '00',
    name: 'Центральный аппарат',
  },
  {
    code: '01',
    name: 'Северо-западный банк',
  },
  {
    code: '02',
    name: 'Юго-восточный банк',
  },
];

export const kmStateMocks: Dictionary[] = [
  {
    code: '00',
    name: 'ЦЕНТРАЛЬНЫЙ АППАРАТ ПАО СБЕРБАНК',
  },
  {
    code: '13',
    name: 'ЦЕНТРАЛЬНО-ЧЕРНОЗЕМНЫЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '16',
    name: 'УРАЛЬСКИЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '38',
    name: 'МОСКОВСКИЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '52',
    name: 'ЮГО-ЗАПАДНЫЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '40',
    name: 'СРЕДНЕРУССКИЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '42',
    name: 'ВОЛГО-ВЯТСКИЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '44',
    name: 'СИБИРСКИЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '54',
    name: 'ПОВОЛЖСКИЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '55',
    name: 'СЕВЕРО-ЗАПАДНЫЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '70',
    name: 'ДАЛЬНЕВОСТОЧНЫЙ БАНК ПАО СБЕРБАНК',
  },
  {
    code: '18',
    name: 'БАЙКАЛЬСКИЙ БАНК ПАО СБЕРБАНК',
  },
];

export const currenciesMock: Dictionary[] = [
  { code: 'RUB', name: 'Российский рубль' },
  { code: 'EUR', name: 'Евро' },
  { code: 'USD', name: 'Доллар США' },
];

export const formDataLabels = {
  amount: 'Доход',
  price: 'Ценовой диапазон',
  currency: 'Валюта',
  project: 'Проект',
  isActive: 'Активность',
  branches: 'Территориальные банки',
  departments: 'Департаменты',
  desks: 'Дески',
  creationDate: 'Дата создания',
  lastUpdate: 'Дата последнего обновления',
  kmStateTypes: 'Стадия продаж КМ',
};

export const formTemplateMock: FormTemplate<FormData> = {
  forms: [
    {
      fieldList: [
        {
          inputType: 'text',
          label: formDataLabels.project,
          name: 'project',
          size: 'sm',
          sizes: gridSizes(12),
        },
        {
          inputType: 'checkbox',
          label: formDataLabels.isActive,
          name: 'isActive',
          size: 'md',
          sizes: gridSizes(12),
          id: 'testId',
        },
        {
          inputType: 'autocomplete',
          label: formDataLabels.branches,
          name: 'branch',
          size: 'sm',
          multiple: false,
          viewType: 'edit',
          viewFormat: 'text',
          sizes: gridSizes(12),
          getOptionLabel: (option) => option.name,
          isOptionEqualToValue: (o1, o2) => o1.code === o2.code,
        },
        {
          inputType: 'autocomplete',
          label: formDataLabels.departments,
          name: 'departments',
          size: 'sm',
          multiple: true,
          viewType: 'edit',
          viewFormat: 'chip',
          sizes: gridSizes(12),
          getOptionLabel: (option) => option.name,
          isOptionEqualToValue: (o1, o2) => o1.code === o2.code,
        },
        {
          inputType: 'autocomplete',
          label: formDataLabels.desks,
          name: 'desks',
          size: 'sm',
          multiple: true,
          viewType: 'edit',
          viewFormat: 'chip',
          sizes: gridSizes(12),
          getOptionLabel: (option) => option.name,
          isOptionEqualToValue: (o1, o2) => o1.code === o2.code,
        },
        {
          inputType: 'autocomplete',
          label: formDataLabels.kmStateTypes,
          name: 'kmStateTypes',
          size: 'sm',
          multiple: true,
          viewType: 'edit',
          viewFormat: 'outerChip',
          sizes: gridSizes(12),
          getOptionLabel: (option) => option.name,
          // isOptionEqualToValue: (o1, o2) => o1.code === o2.code,
          getOptionIdentifier: (option) => option.name,
        },
      ],
      tabKey: 'general',
      tabName: 'Основная информация',
    },
    {
      fieldList: [
        {
          inputType: 'number',
          label: formDataLabels.amount,
          name: 'amount',
          size: 'sm',
          sizes: gridSizes(12),
          prefix: '$',
        },
        {
          inputType: 'number-range',
          label: formDataLabels.price,
          size: 'sm',
          sizes: gridSizes(12),
          name: 'price',
        },
        {
          inputType: 'autocomplete',
          label: formDataLabels.currency,
          name: 'currencies',
          size: 'sm',
          multiple: true,
          viewType: 'edit',
          viewFormat: 'chip',
          sizes: gridSizes(12),
          getOptionLabel: (option) => option.code,
          isOptionEqualToValue: (o1, o2) => o1.code === o2.code,
        },
      ],
      tabKey: 'counting',
      tabName: 'Расчеты',
    },
    {
      fieldList: [
        {
          inputType: 'date-range',
          label: formDataLabels.creationDate,
          name: 'creationDate',
          size: 'sm',
          sizes: gridSizes(12),
        },
        {
          inputType: 'date',
          label: formDataLabels.lastUpdate,
          name: 'lastUpdate',
          size: 'sm',
          sizes: gridSizes(12),
        },
      ],
      tabKey: 'dates',
      tabName: 'Даты',
    },
  ],
  viewType: 'anchors',
};

export const dictionariesMock: FormDictionaryMap<FormData> = {
  departments: departmentsMock,
  desks: desksMock,
  branch: branchesMock,
  currencies: currenciesMock,
  kmStateTypes: kmStateMocks,
};

export const formTemplateUtilsMock: FormTemplate<FormData> = {
  forms: [
    {
      fieldList: [
        makeTextObject('project', formDataLabels.project),
        makeSingleAutocompleteObject('branch', formDataLabels.branches),
        makeMultipleAutocompleteObject('departments', formDataLabels.departments),
        makeMultipleAutocompleteObject('desks', formDataLabels.desks),
        makeMultipleAutocompleteOuterChipObject('kmStateTypes', formDataLabels.kmStateTypes),
      ],
      tabKey: 'general',
      tabName: 'Основная информация',
    },
    {
      fieldList: [
        makeNumberObject('amount', formDataLabels.amount, { multiplier: 1e-6 }),
        makeNumberRangeObject('price', formDataLabels.price),
        makeMultipleAutocompleteObject('currencies', formDataLabels.currency),
      ],
      tabKey: 'counting',
      tabName: 'Расчеты',
    },
    {
      fieldList: [makeDateRangeObject('creationDate', formDataLabels.creationDate)],
      tabKey: 'dates',
      tabName: 'Даты',
    },
  ],
  viewType: 'anchors',
};
