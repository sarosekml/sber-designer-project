import { useMemo } from 'react';

type TableRowContextProps<RowType extends object> = {
  showToggleIcon?: (row: RowType) => boolean;
};

export const useToggleDetailContext = <RowType extends object>({ showToggleIcon }: TableRowContextProps<RowType>) => {
  return useMemo(
    () => ({
      showToggleIcon: showToggleIcon,
    }),
    [showToggleIcon],
  );
};
