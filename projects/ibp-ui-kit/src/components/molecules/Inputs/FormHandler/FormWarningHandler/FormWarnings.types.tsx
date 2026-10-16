import React from 'react';
import { FieldError, FieldValues, Resolver } from 'react-hook-form';

export interface FormWarningsProps<FormDataType extends FieldValues = any> {
  children: React.ReactNode;
  /**
   * defines a function that validates the compliance of input to what user needs be warned of. Can be a function or a `yupResolver(someWarningSchema())`
   */
  resolver: Resolver<FormDataType>;
  /**
   * @default 'all'
   * shows if we validate all fields or fields touched by user
   */
  validate?: 'all' | 'dirty';
}

export interface FormWarningsContextData<FormDataType extends FieldValues = any> {
  warnings: Map<keyof FormDataType, FieldError>;
}
