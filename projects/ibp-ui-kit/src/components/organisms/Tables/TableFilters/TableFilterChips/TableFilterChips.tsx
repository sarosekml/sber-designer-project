/* eslint-disable @typescript-eslint/ban-types */
import React, { memo, useCallback, useMemo } from 'react';

import { FiltersChips } from '@/components/organisms/FiltersChips';
import { clearTableFilters } from '@/components/organisms/FiltersChips/FiltersChips.utils';

import { LabeledFilters } from '../../../FiltersChips/FiltersChips.types';
import { useTable } from '../../utils';
import { useFilterPresets } from '../FilterPresets.context';
import { getStaticFilters } from '../TableFilters.utils';

import { defaultLabelResolvers } from './TableFilterChips.resolvers';
import { TableFilterChipsProps } from './TableFilterChips.types';
import { resolveLabels } from './TableFilterChips.utils';

const TableFilterChipsComponent = <Filter extends object>({
  tableCode,
  labelResolvers = defaultLabelResolvers,
  emptyFilters = {} as Filter,
  filtersChipsConfig,
  localization,
  staticFilterKeys,
  onCustomClearFilters,
}: TableFilterChipsProps<Filter>) => {
  const { tableState, controller } = useTable<never, Filter>(tableCode);
  const labeledFilters = useMemo(
    () => resolveLabels(tableState?.filters ?? emptyFilters, labelResolvers),
    [tableState?.filters, labelResolvers, emptyFilters],
  );

  const { presets, storePresets } = useFilterPresets();

  const onClearFilters = useCallback(
    (filterIds?: (keyof LabeledFilters<Filter>)[]) => {
      if (!tableState?.filters) return;

      onCustomClearFilters?.(filterIds);

      if (presets) {
        void storePresets(presets.map((item) => ({ ...item, active: false })));
      }

      if (!filterIds) {
        if (staticFilterKeys?.length) {
          const staticFilters = getStaticFilters(staticFilterKeys, tableState?.filters);
          return controller.setFilters(staticFilters);
        }

        return controller.setFilters(emptyFilters);
      }

      const newFilters = clearTableFilters(filterIds, tableState?.filters);
      controller.setFilters(newFilters);
    },
    [tableState?.filters, onCustomClearFilters, presets, controller, storePresets, staticFilterKeys, emptyFilters],
  );

  return (
    <FiltersChips
      filtersChipsConfig={filtersChipsConfig}
      localization={localization}
      onClearFilters={onClearFilters}
      filters={labeledFilters}
      //eslint-disable-next-line
      //@ts-ignore
      staticFilterKeys={staticFilterKeys}
    />
  );
};

export const TableFilterChips = memo(TableFilterChipsComponent) as typeof TableFilterChipsComponent & {
  displayName: string;
};

TableFilterChips.displayName = 'TableFilterChips';
