import { Ref, useImperativeHandle, useRef } from 'react';

export interface FirstExistingValueController {
  resetValue: () => void;
}

/**
 * This hook is used to handle data from the Query to ignore cache invalidations.
 * In most cases you don't need this hook, because it's better to use lazy query instead of the plain hook.
 * But in some cases you can't use lazy query because of the limitations or it's event not related with querying,
 * so that's why this hook exists
 */
export const useFirstExistingValue = <T>(value: T | undefined, controller?: Ref<FirstExistingValueController>) => {
  const firstExistingValue = useRef(value);
  const allowNextValue = useRef(true);

  useImperativeHandle(controller, () => ({
    resetValue: () => {
      allowNextValue.current = true;
    },
  }));

  if (allowNextValue.current && firstExistingValue.current !== value) {
    firstExistingValue.current = value;
    allowNextValue.current = false;
  }
  return firstExistingValue.current;
};
