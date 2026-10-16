import { useCallback } from 'react';

import { FieldValues } from '@/components/molecules';

import { useTable } from '../../../Tables/utils';
import { getStaticFilters } from '../TableFilters.utils';

import { TableFilterModalProps } from './TableFilterModal.types';

export const useClearAllFilters = <Filter extends object, FormType extends FieldValues>({
  tableCode,
  onCustomClearFilters,
  staticFilterKeys,
  emptyFilter,
}: Pick<
  TableFilterModalProps<Filter, FormType>,
  'emptyFilter' | 'onCustomClearFilters' | 'staticFilterKeys' | 'tableCode'
>) => {
  const { tableState, controller } = useTable<never, Filter>(tableCode);

  return useCallback(() => {
    onCustomClearFilters?.();

    if (staticFilterKeys?.length) {
      const staticFilters = getStaticFilters(staticFilterKeys, tableState?.filters);
      controller.setFilters(staticFilters);
    } else {
      controller.setFilters(emptyFilter);
    }
  }, [controller, emptyFilter, onCustomClearFilters, staticFilterKeys, tableState?.filters]);
};
