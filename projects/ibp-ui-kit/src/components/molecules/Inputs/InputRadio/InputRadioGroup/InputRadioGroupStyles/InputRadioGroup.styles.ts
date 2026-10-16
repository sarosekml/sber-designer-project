import { MediumSizeType } from '@/types/common.types';
import { Sx } from '@/utils/mergeSx';

import { InputRadioGroupOrientation } from '../InputRadioGroup.types';

import { fontVariants, listGap, textMargin } from './InputRadioGroup.const';

export const getInputRadioGroupTextStyles = (size: MediumSizeType): Sx => ({
  typography: fontVariants[size],
  mb: textMargin[size],
});

export const getInputRadioGroupListStyles = (size: MediumSizeType, orientation: InputRadioGroupOrientation): Sx => ({
  flexDirection: orientation === 'horizontal' ? 'row' : 'column',
  gap: listGap[size],
});
