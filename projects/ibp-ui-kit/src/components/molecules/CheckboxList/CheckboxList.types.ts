import { DataTestIdProps, MediumSizeType } from '@/types/common.types';

export interface CheckboxListData {
  label: string;
  checked: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  name?: string;
  id: string;
}

export interface CheckboxListProps extends DataTestIdProps {
  description?: string;
  disabled?: boolean;
  title: string;
  checkboxSize?: MediumSizeType;
  data?: CheckboxListData[];
  onChange: (data: CheckboxListData[]) => void;
}
