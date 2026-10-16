import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  Field,
  FieldError,
  FieldValues,
  Resolver,
  ResolverOptions,
  useFormContext,
  UseFormReturn,
  useWatch,
} from 'react-hook-form';

import { isEqual } from '@sber-ibp/core';

import { defaultContextData, FormWarningsContext } from './FormWarnings.context';
import { FormWarningsContextData, FormWarningsProps } from './FormWarnings.types';

const computeResolverOptions = <FormDataType extends FieldValues>(
  context: UseFormReturn<FormDataType>,
): ResolverOptions<FormDataType> => {
  const fieldEntries = new Map<keyof FormDataType, Field['_f']>();
  for (const key in context.control._fields) {
    const field = context.control._fields[key];
    if (!field) continue;
    fieldEntries.set(key, field['_f']);
  }
  return {
    shouldUseNativeValidation: undefined,
    fields: Object.fromEntries(fieldEntries),
  };
};

const collectSchemaErrors = async <FormDataType extends FieldValues>(
  context: UseFormReturn<FormDataType>,
  resolver: Resolver<FormDataType>,
  isValidationApplied: (name: keyof FormDataType) => boolean,
) => {
  const result = await resolver(context.watch(), context, computeResolverOptions(context));
  const errorsMap = new Map<string, FieldError>();
  for (const key in result.errors) {
    if (!isValidationApplied(key)) continue;
    errorsMap.set(key, result.errors[key]);
  }
  return errorsMap;
};

const FormWarningsComponent = <FormDataType extends FieldValues>({
  children,
  resolver,
  validate,
}: FormWarningsProps<FormDataType>) => {
  const [contextData, setContext] = useState<FormWarningsContextData<FormDataType>>(defaultContextData);
  const formData = useWatch<FormDataType>();
  // const formState = useFormState<FormDataType>();
  const context = useFormContext<FormDataType>();

  const isValidationApplied = useMemo(
    () => (validate === 'all' ? () => true : (name: keyof FormDataType) => name in context.formState.dirtyFields),
    [validate, context],
  );

  useEffect(() => {
    void collectSchemaErrors(context, resolver, isValidationApplied).then((warnings) => {
      if (!isEqual(Object.fromEntries(contextData.warnings), Object.fromEntries(warnings))) {
        setContext({ warnings });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  return <FormWarningsContext.Provider value={contextData}>{children}</FormWarningsContext.Provider>;
};
FormWarningsComponent.displayName = 'FormWarnings';

export const FormWarnings = memo(FormWarningsComponent) as typeof FormWarningsComponent;
