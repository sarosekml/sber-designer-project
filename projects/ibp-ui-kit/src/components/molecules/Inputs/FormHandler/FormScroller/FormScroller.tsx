import React, { memo, useEffect } from 'react';
import { FieldErrors, useFormContext, useFormState } from 'react-hook-form';

import { SxBox } from '@/components/atoms/SxBox';

import { FormScrollerProps } from './FormScroller.types';

const getInputNamesFromErrors = (errors: FieldErrors) => {
  // When we search for inputs on the level of DOM elements
  // we can't identify which name the base input have,
  // for now it's consistent and all DOM elements have the
  // same name as it's provided on the react level except for InputRange component
  // which changes names when pass them to sub-inputs, so we just add
  // manually versions of this names.
  // (!) In case we move components like DateRange to ui-kit or other new elements with other name
  // modifications, please update this function.
  return Object.keys(errors).flatMap((name) => [name, `RangeInputFrom_${name}`, `RangeInputTo_${name}`]);
};

export const FormScroller = memo(({ onFindElement, children }: FormScrollerProps) => {
  const context = useFormContext();
  const formState = useFormState(context);

  useEffect(() => {
    const inputNames = getInputNamesFromErrors(formState.errors);
    if (!inputNames.length) return;

    const firstElementWithName = onFindElement(inputNames);
    if (firstElementWithName) {
      firstElementWithName?.scrollIntoView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.errors]);

  return <SxBox>{children}</SxBox>;
});

FormScroller.displayName = 'FormScroller';
