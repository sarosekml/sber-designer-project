import { ColumnWidthInfo } from '../TableProps';
import { EmployeeData } from './types';

export const columnsWidthsMock: ColumnWidthInfo<EmployeeData>[] = [
  {
    columnName: 'id',
    width: 100,
  },
  {
    columnName: 'active',
    width: 100,
  },
  {
    columnName: 'personalNumber',
    width: 140,
  },
  {
    columnName: 'fullName',
    width: 180,
  },
  {
    columnName: 'desks',
    width: 200,
  },
  {
    columnName: 'role',
    width: 170,
  },
  {
    columnName: 'lastEntrance',
    width: 200,
  },
  {
    columnName: 'cards',
    width: 140,
  },
  {
    columnName: 'comment',
    width: 180,
  },
];
