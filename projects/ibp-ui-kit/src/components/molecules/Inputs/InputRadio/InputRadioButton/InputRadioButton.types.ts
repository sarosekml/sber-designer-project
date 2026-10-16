import { BaseInputProps } from '@/components/molecules/Inputs/InternalComponents/BaseInput/BaseInput.types';
import { DataTestIdProps } from '@/types/common.types';

type InputRadioButtonBaseType = Pick<
  BaseInputProps,
  'label' | 'name' | 'helperText' | 'disabled' | 'viewType' | 'size' | 'value'
>;

export interface InputRadioButtonProps extends InputRadioButtonBaseType, DataTestIdProps {
  onChange?: () => void;
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export type InputRadioButtonStyleType = Pick<InputRadioButtonProps, 'disabled'> &
  Required<Pick<InputRadioButtonProps, 'viewType' | 'size'>>;
