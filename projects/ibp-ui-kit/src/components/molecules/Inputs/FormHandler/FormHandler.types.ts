import { ReactNode } from 'react';
import { FieldError, FieldPath, FieldValues, SubmitHandler, UseControllerReturn, UseFormReturn } from 'react-hook-form';

import { DataTestIdProps } from '@/types/common.types';

import { BaseInputValidationOptions, InputViewType } from '../InternalComponents/BaseInput/BaseInput.types';

export interface TypeInputHandlerProps {
  viewType?: InputViewType;
  disabled?: boolean;
}

export interface FormHandlerProps<Data extends FieldValues> extends DataTestIdProps, TypeInputHandlerProps {
  children: ReactNode;
  formId: string;
  methods: UseFormReturn<Data>;
  onBlur?: SubmitHandler<Data>;
  onSubmit?: SubmitHandler<Data>;
  /**
   * @default true
   */
  scrollToErrors?: boolean;
}

export interface InputControllerReturnType<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends UseControllerReturn<TFieldValues, TName> {
  inputProps: TypeInputHandlerProps;
  warning?: FieldError;
  validationOptions?: BaseInputValidationOptions;
}
