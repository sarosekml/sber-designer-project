import React from 'react';

import { MediumSizeType } from '@/types';

import { CheckboxTableItem } from '../CheckboxTable.types';

export interface CheckboxTableRowProps extends CheckboxTableItem {
  isHeaderRow?: boolean;
  checkboxSize?: MediumSizeType;
  onChange?: (e: React.ChangeEvent | React.MouseEvent) => void;
}
