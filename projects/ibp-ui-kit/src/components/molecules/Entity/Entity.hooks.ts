import { useMemo } from 'react';

export const useNotFitCount = (itemsLength?: number, max?: number, showPlus?: boolean) => {
  return useMemo(() => {
    if (itemsLength == null || max == null || itemsLength <= max) {
      return '0';
    }

    const count = String(itemsLength - max);
    return showPlus ? '+' + count : count;
  }, []);
};
