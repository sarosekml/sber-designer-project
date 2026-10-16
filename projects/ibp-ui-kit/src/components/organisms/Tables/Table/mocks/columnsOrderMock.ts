import { ColumnName } from '@/components/organisms/Tables/Table';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

export const columnsOrderMock: ColumnName<EmployeeData>[] = [
  'id',
  'active',
  'lastEntrance',
  'personalNumber',
  'role',
  'fullName',
  'desks',
  'cards',
  'comment',
];
