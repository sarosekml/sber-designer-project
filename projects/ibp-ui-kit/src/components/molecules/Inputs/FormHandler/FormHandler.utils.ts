import { useMemo } from 'react';
import { FieldError } from 'react-hook-form';

import { emptyString } from '@sber-ibp/core';

import { BaseInputValidationOptions } from '../InternalComponents/BaseInput/BaseInput.types';

import { TypeInputHandlerProps } from './FormHandler.types';

export const mergeWithFormProps = <ComponentProps extends TypeInputHandlerProps>(
  formProps: TypeInputHandlerProps,
  componentProps: ComponentProps,
): ComponentProps => {
  return { ...formProps, ...componentProps };
};

export const findElementByName = (names: string[], root?: HTMLElement) => {
  const namedElements = root?.querySelectorAll('[name]');
  if (!namedElements) return;

  const nameSet = new Set(names);
  return Array.from(namedElements).find((el) => {
    const name = el.getAttribute('name');
    return name && nameSet.has(name);
  });
};

export const useValidationOptions = (error?: FieldError, warning?: FieldError) =>
  useMemo<BaseInputValidationOptions | undefined>(() => {
    if (!error && !warning) return undefined;
    return {
      message: warning?.message ?? error?.message ?? emptyString,
      type: warning ? 'warning' : 'error',
    };
  }, [error, warning]);
