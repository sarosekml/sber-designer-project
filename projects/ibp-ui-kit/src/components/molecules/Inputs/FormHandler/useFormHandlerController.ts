import { useContext, useMemo } from 'react';
import { FieldPath, FieldValues, useController, UseControllerProps } from 'react-hook-form';
import { FormHandlerContext } from './FormHandler.context';
import { InputControllerReturnType } from './FormHandler.types';
import { useValidationOptions } from './FormHandler.utils';
import { FormWarningsContext } from './FormWarningHandler/FormWarnings.context';

/**
 * There is no ability to pass additional parameters as props to the root
 * component, so we pass them via context. The only needed parameter here
 * is `dataTestId`.
 */
export const useInputHandlerController = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(
  props: UseControllerProps<TFieldValues, TName>,
): InputControllerReturnType<TFieldValues, TName> => {
  const inputProps = useContext(FormHandlerContext);
  const controller = useController<TFieldValues, TName>(props);
  const { warnings } = useContext(FormWarningsContext);
  const validationOptions = useValidationOptions(controller?.fieldState?.error, warnings.get(props.name));

  return useMemo(() => ({ inputProps, validationOptions, ...controller }), [inputProps, validationOptions, controller]);
};
