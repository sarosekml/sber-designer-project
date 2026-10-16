import { DataTestIdProps } from '@/types/common.types';

import { BaseInputProps } from '../InternalComponents/BaseInput/BaseInput.types';

type InputCheckboxBaseType = Pick<BaseInputProps, 'label' | 'name' | 'helperText' | 'disabled' | 'viewType' | 'size'>;

export type InputCheckboxChangeCallback = (checked: boolean, event?: React.ChangeEvent<HTMLInputElement>) => void;

export interface InputCheckboxProps extends InputCheckboxBaseType, DataTestIdProps {
  checked?: boolean;
  onChange?: InputCheckboxChangeCallback;
  indeterminate?: boolean;
  id?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export type InputCheckboxStyleType = Pick<InputCheckboxProps, 'checked' | 'indeterminate' | 'disabled'> &
  Required<Pick<InputCheckboxProps, 'size' | 'viewType'>>;
