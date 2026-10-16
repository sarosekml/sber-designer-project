import { MediumSizeType } from '@/types/common.types';

import { CheckboxListData } from '../CheckboxList.types';

export interface CheckboxListRowProps extends CheckboxListData {
  dataTestId?: string;
  isHeaderRow?: boolean;
  checkboxSize?: MediumSizeType;
  onChange: (checkboxId: string) => void;
}
