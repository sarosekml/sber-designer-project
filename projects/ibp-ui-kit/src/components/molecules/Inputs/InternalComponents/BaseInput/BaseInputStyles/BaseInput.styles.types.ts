import { Theme } from '@mui/system';

import { MediumSizeType } from '@/types/common.types';
import { Sx } from '@/utils';

import { BaseInputProps } from '../BaseInput.types';

export type BaseInputIconColorStyleType = Pick<BaseInputProps, 'disabled'>;

export type BaseInputBorderStyleType = Omit<BaseInputProps, 'value' | 'label' | 'dataTestId' | 'name'> & {
  focused: boolean;
  theme: Theme;
};

export type BaseInputStyleType = Omit<BaseInputProps, 'value' | 'label' | 'dataTestId' | 'name'> & {
  focused: boolean;
};

type ValueTextStyleProps = {
  size?: MediumSizeType;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  textColor?: string;
};

export interface BaseInputReadAndPresentStyleType {
  container: Sx;
  valueReadContainer: (isValidation: boolean) => Sx;
  valuePresentContainer: (isValidation: boolean, size?: MediumSizeType) => Sx;
  valueText: (props: ValueTextStyleProps) => Sx;
}
