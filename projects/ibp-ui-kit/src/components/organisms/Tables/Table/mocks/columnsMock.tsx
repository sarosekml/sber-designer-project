import React from 'react';

import { Icon } from '@/components/atoms';
import { Column, ColumnsConfig } from '@/components/organisms/Tables/Table';
import { CitiesType, EmployeeData, UserData } from '@/components/organisms/Tables/Table/mocks/types';

export const columnsMergeRowMock: Column<UserData & CitiesType>[] = [
  { name: 'personalNumber', title: 'Табельный номер' },
  { name: 'fullName', title: 'ФИО' },
  { name: 'name', title: 'Название города' },
  { name: 'code', title: 'Код города' },
];

export const columnsMock: ColumnsConfig<EmployeeData> = [
  { name: 'id', title: 'ID', width: 70, align: 'left' },
  {
    name: 'active',
    title: 'Статус',
    width: 200,
    sortingEnabled: true,
    render: () => <Icon name="Check" color="secondary" dataTestId="TableStory" />,
  },
  { name: 'lastEntrance', title: 'Последний вход', width: 300 },
  {
    name: 'personalNumber',
    title: 'Табельный номер',
    sortingEnabled: true,
    sortingDirection: 'asc',
    width: 205,
    hidden: true,
    wordWrapEnabled: true,
    minWidth: 150,
    maxWidth: 250,
    fixed: 'left',
  },
  { name: 'desks', title: 'Тип' },
  { name: 'role', title: 'Роль', width: 170 },
  { name: 'fullName', title: 'ФИО', align: 'center', width: 200 },
  { name: 'cards', title: 'Банковские карты с самой лучшей защитой, и биометрией при оплате', width: 140 },
  { name: 'comment', title: 'Комментарий', width: 180 },
];

export const columnsUtilsMock: ColumnsConfig<EmployeeData> = [
  { name: 'id', title: 'ID', width: 80, align: 'left' },
  {
    name: 'active',
    title: 'Статус',
    width: 70,
    align: 'center',
    sortingEnabled: true,
    render: () => <Icon name={'Check'} color="secondary" dataTestId="TableStory" />,
  },
  { name: 'lastEntrance', title: 'Последний вход', width: 150 },
  {
    name: 'personalNumber',
    title: 'Табельный номер',
    sortingEnabled: true,
    sortingDirection: 'asc',
    width: 150,
    hidden: true,
    align: 'right',
    wordWrapEnabled: true,
  },
  { name: 'desks', title: 'Дески', width: 250 },
  { name: 'role', title: 'Роль', width: 150 },
  { name: 'fullName', title: 'ФИО', align: 'center', width: 200 },
  { name: 'comment', title: 'Комментарий', width: 180 },
];
