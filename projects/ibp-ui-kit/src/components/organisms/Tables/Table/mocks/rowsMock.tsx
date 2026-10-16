import { EmployeeData, EmployeeDataWithDetails, UserData } from '@/components/organisms/Tables/Table/mocks/types';

export const rowsMergeRowMock: UserData[] = [
  {
    personalNumber: '1',
    fullName: 'Иванов И.Э.',
    cities: [
      { name: 'Белгород', code: 1 },
      { name: 'Москва', code: 2 },
      { name: 'Магадан', code: 3 },
    ],
  },
  {
    personalNumber: '2',
    fullName: 'Сидоров Н.Ю.',
    cities: [
      { name: 'Хабаровск', code: 4 },
      { name: 'Владивосток', code: 5 },
      { name: 'Курск', code: 6 },
      { name: 'Липецк', code: 7 },
    ],
  },
  {
    personalNumber: '3',
    fullName: 'Петров Д.В.',
    cities: [
      { name: 'Краснодар', code: 8 },
      { name: 'Мурманск', code: 9 },
    ],
  },
];

export const rowsForVirtualizeTableMock: EmployeeData[] = new Array(1000).fill(0).map((_value, idx) => ({
  active: true,
  personalNumber: `018359${idx}`,
  fullName: 'Константинопольский К.К.',
  role: 'BusinessAdmin',
  lastEntrance: (Math.random() * 100000) % 100000,
  cards: [],
  id: String(idx),
  desks: [
    { name: 'Финансирование AFP', code: '1' },
    { name: 'Кредитование', code: '2' },
    { name: 'Лизинговые платежи', code: '3' },
    { name: 'Кредитная линия', code: '4' },
  ],
}));

export const rowsMock: EmployeeData[] = [
  {
    active: true,
    personalNumber: '01835961',
    fullName: 'Константинопольский К.К.',
    role: 'BusinessAdmin',
    lastEntrance: 1640862169107,
    cards: [],
    id: '12345',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: true,
    personalNumber: '01835962',
    fullName: 'Орлова Д.М.',
    role: 'Analyst',
    lastEntrance: 1640862170429,
    cards: ['Sber'],
    id: '23456',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: true,
    personalNumber: '01835963',
    fullName: 'Иванов К.М.',
    role: 'Financier',
    lastEntrance: 1640862171377,
    cards: ['Sber', 'TKf'],
    id: '34567',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: false,
    personalNumber: '01835964',
    fullName: 'Климов А.К.',
    role: 'Auditor',
    lastEntrance: 1640862172299,
    cards: ['Sber', 'TKf', 'Alfa'],
    id: '45678',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: false,
    personalNumber: '01835965',
    fullName: 'Бойченко А.В.',
    role: 'pmc',
    lastEntrance: 1640862173405,
    cards: [],
    id: '56789',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
];

export const rowsEmployeeMockWithDetail: EmployeeDataWithDetails[] = [
  {
    hasDetails: true,
    active: true,
    personalNumber: '01835961',
    fullName: 'Константинопольский К.К.',
    role: 'BusinessAdmin',
    lastEntrance: 1640862169107,
    cards: [],
    id: '12345',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
    details: {
      date: {
        name: 'Дата',
        oldValue: '',
        newValue: '22.06.2022',
        isGroup: false,
      },
      direction: {
        name: 'Направление',
        oldValue: '',
        newValue: 'Входящий',
        isGroup: false,
      },
      knr: {
        isGroup: true,
        name: 'Контрагент',
        paymentknr: {
          name: 'Платежный контрагент',
          oldValue: 'ООО "Ромашка"',
          newValue: 'ООО "Одуванчик"',
        },
        paymentInn: {
          name: 'ИНН плетельщика',
          oldValue: '6123012938',
          newValue: '1293871230',
        },
      },
    },
  },
  {
    hasDetails: true,
    details: {
      date: {
        name: 'Дата',
        oldValue: '',
        newValue: '22.06.2022',
        isGroup: false,
      },
      direction: {
        name: 'Направление',
        oldValue: '',
        newValue: 'Входящий',
        isGroup: false,
      },
      knr: {
        isGroup: true,
        name: 'Контрагент',
        paymentknr: {
          name: 'Платежный контрагент',
          oldValue: 'ООО "Подсолнух"',
          newValue: 'ООО "Роза"',
        },
        paymentInn: {
          name: 'ИНН плетельщика',
          oldValue: '9877896545',
          newValue: '4123877343',
        },
      },
    },
    active: true,
    personalNumber: '01835962',
    fullName: 'Орлова Д.М.',
    role: 'Analyst',
    lastEntrance: 1640862170429,
    cards: ['Sber'],
    id: '23456',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    hasDetails: false,
    active: true,
    personalNumber: '01835963',
    fullName: 'Иванов К.М.',
    role: 'Financier',
    lastEntrance: 1640862171377,
    cards: ['Sber', 'TKf'],
    id: '34567',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
];

export const rowsForUtilsMock: EmployeeData[] = [
  {
    active: true,
    personalNumber: '01835961',
    fullName: '',
    role: 'BusinessAdmin',
    lastEntrance: 222222222222222,
    cards: [],
    id: '12345',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: true,
    personalNumber: '01835962',
    fullName: 'Орлова Д.М.',
    role: 'Analyst',
    lastEntrance: 22222222222222,
    cards: ['Sber'],
    id: '23456',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
    ],
  },
  {
    active: true,
    personalNumber: '01835963',
    fullName: 'Иванов К.М.',
    role: 'Financier',
    lastEntrance: 1640862171377,
    cards: ['Sber', 'TKf'],
    id: '34567',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: false,
    personalNumber: '01835964',
    fullName: 'Климов А.К.',
    role: 'Auditor',
    lastEntrance: 1640862172299,
    cards: ['Sber', 'TKf', 'Alfa'],
    id: '45678',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
  {
    active: false,
    personalNumber: '01835965',
    fullName: 'Бойченко А.В.',
    role: 'pmc',
    lastEntrance: 1640862173405,
    cards: [],
    id: '56789',
    desks: [
      { name: 'Финансирование AFP', code: '1' },
      { name: 'Кредитование', code: '2' },
      { name: 'Лизинговые платежи', code: '3' },
      { name: 'Кредитная линия', code: '4' },
    ],
  },
];
