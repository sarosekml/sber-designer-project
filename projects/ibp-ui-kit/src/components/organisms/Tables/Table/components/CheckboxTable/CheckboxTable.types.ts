import { ChangeEvent, MouseEvent } from 'react';

import { DataTestIdProps, MediumSizeType } from '@/types/common.types';

export interface CheckboxTableItem {
  label: string;
  checked: boolean;
  disabled?: boolean;
}

export interface CheckboxTableProps extends DataTestIdProps {
  isCheckboxList?: boolean;
  title: string;
  isAllChecked: boolean;
  checkboxSize?: MediumSizeType;
  data: CheckboxTableItem[] | React.ReactNode;
  onChange?: (e: ChangeEvent | MouseEvent) => void;
  onChangeAll?: (e: ChangeEvent | MouseEvent) => void;
}
