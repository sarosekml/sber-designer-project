import { DataTestIdProps } from '@/types/common.types';

import { BaseInputProps } from '../InternalComponents/BaseInput/BaseInput.types';

export type InputSwitchChangeCallback = (checked: boolean, event?: React.ChangeEvent<HTMLInputElement>) => void;

type InputSwitchBaseType = Pick<BaseInputProps, 'label' | 'name' | 'helperText' | 'disabled' | 'viewType' | 'size'>;

export interface InputSwitchProps extends InputSwitchBaseType, DataTestIdProps {
  checked?: boolean;
  onChange?: InputSwitchChangeCallback;
}

export type InputSwitchStyleType = Pick<InputSwitchProps, 'disabled' | 'viewType' | 'checked' | 'size'>;
