import { useMemo } from 'react';

import { TableTestKeys } from '@/components/organisms/Tables/Table/Table.const';

import { TableInternalPlainModel } from '../../TableProps';

/**
 * There is no ability to pass additional parameters as props to the root
 * component, so we pass them via context. The only needed parameter here
 * is `dataTestId`.
 */
export const useRootContext = <RowType extends object, Filter extends object>({
  dataTestId,
}: TableInternalPlainModel<RowType, Filter>) => {
  const testId = `${dataTestId}_${TableTestKeys.tableKey}`;

  return useMemo(
    () => ({
      dataTestId: testId,
    }),
    [testId],
  );
};
