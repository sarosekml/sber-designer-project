import { ColumnName, ColumnWidthInfo } from '@/components/organisms/Tables/Table';
import { EmployeeData } from '@/components/organisms/Tables/Table/mocks/types';

interface ColumnsDefaultConfig {
  order: ColumnName<EmployeeData>[];
  columnWidths: ColumnWidthInfo<EmployeeData>[];
  hiddenColumnNames: ColumnName<EmployeeData>[];
}

export const useInitialColumnsConfig = (
  tableKey: string,
  defaultValues: ColumnsDefaultConfig,
): ColumnsDefaultConfig => {
  const savedConfig = localStorage.getItem(tableKey);
  return !savedConfig ? defaultValues : JSON.parse(savedConfig ?? '');
};
