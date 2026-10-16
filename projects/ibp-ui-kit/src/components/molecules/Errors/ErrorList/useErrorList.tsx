import React, { useCallback, useMemo, useRef } from 'react';
import { ErrorList as ErrorListRoot } from './ErrorList';
import { ErrorType, getErrorMessage, useRerender } from './utils';

export type ExtendedErrorType = ErrorType | undefined;

export const useErrorList = () => {
  const errors = useRef<Set<string>>(new Set());
  const removedErrors = useRef<Set<string>>(new Set());
  const { triggerRerender, rerenderCounter } = useRerender();

  const addError = useCallback(
    (error: ExtendedErrorType) => {
      if (!error) return;
      const errorMessage = getErrorMessage(error);
      if (!errors.current.has(errorMessage)) {
        errors.current.add(errorMessage);
        triggerRerender();
      }
    },
    [errors, triggerRerender],
  );

  const addErrors = useCallback(
    (errorList: ExtendedErrorType[]) => {
      const errorsToAdd = errorList
        .map((it) => getErrorMessage(it as ErrorType))
        .filter((error) => Boolean(error) && !errors.current.has(error));

      if (!errorsToAdd.length) return;

      errors.current = new Set([...errors.current, ...errorsToAdd]);
      triggerRerender();
    },
    [errors, triggerRerender],
  );

  const removeErrors = useCallback(() => {
    removedErrors.current = new Set(errors.current);
    triggerRerender();
  }, [triggerRerender]);

  const errorList = useMemo(
    () => Array.from(errors.current).filter((error) => !removedErrors.current.has(error)),
    [errors.current, removedErrors.current, rerenderCounter],
  );

  const ErrorList = useMemo(() => {
    return () => <ErrorListRoot errors={errorList} removeError={removeErrors} />;
  }, [errorList, removeErrors]);

  return {
    ErrorList,
    addError,
    addErrors,
    errors: errorList,
    removeErrors,
  };
};
