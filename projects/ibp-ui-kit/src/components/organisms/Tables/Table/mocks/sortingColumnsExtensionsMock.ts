import { SortingExtension } from '@/components/organisms/Tables/Table';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

export const sortingColumnsExtensionsMock: SortingExtension<EmployeeData>[] = [
  { columnName: 'active', sortingEnabled: false },
  { columnName: 'personalNumber', sortingEnabled: true },
  { columnName: 'fullName', sortingEnabled: false },
  { columnName: 'desks', sortingEnabled: false },
  { columnName: 'role', sortingEnabled: true },
  { columnName: 'lastEntrance', sortingEnabled: false },
  { columnName: 'comment', sortingEnabled: false },
];
