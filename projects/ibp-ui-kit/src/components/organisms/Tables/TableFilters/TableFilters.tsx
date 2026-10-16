import React, { memo, useMemo } from 'react';

import { Grid } from '@/components/atoms/gridTiles';
import { FieldValues } from '@/components/molecules/Inputs';

import { EditPresetsModal, useEditPresetsModalVisibleController } from '../../FiltersModal/components/EditPresetsModal';
import { useFilterPresetsController } from '../utils/useFilterPresetsController';

import { defaultLabelResolvers } from './TableFilterChips/TableFilterChips.resolvers';
import { FilterPresetsContextProvider } from './FilterPresets.context';
import { FilterLabelResolver, TableFilterChips } from './TableFilterChips';
import { TableFilterModal } from './TableFilterModal';
import { makeDictionaryTargetedResolvers, makeDictionaryUniversalResolver } from './TableFilters.resolvers';
import { TableFiltersProps } from './TableFilters.types';

export const TableFiltersComponent = <Filter extends object, FormType extends FieldValues>({
  cacheLoader,
  labelResolvers,
  dictionariesMap,
  ...props
}: TableFiltersProps<Filter, FormType>) => {
  const resolvers = useMemo<FilterLabelResolver<Filter>[]>(
    () => [
      ...makeDictionaryTargetedResolvers(props.filtersChipsConfig, dictionariesMap, labelResolvers),
      makeDictionaryUniversalResolver(dictionariesMap),
      ...(labelResolvers ?? defaultLabelResolvers),
    ],
    [dictionariesMap, labelResolvers, props.filtersChipsConfig],
  );

  const filterPresetsContext = useFilterPresetsController(props.tableCode, cacheLoader);

  const {
    closeModal: closeEditPresetsModal,
    openModal: openEditPresetsModal,
    visible: visibleEditPresetsModal,
  } = useEditPresetsModalVisibleController();

  return (
    <FilterPresetsContextProvider value={filterPresetsContext}>
      <Grid container item rowGap={1} alignItems={'center'} sizes={{ xs: 10 }}>
        <TableFilterModal {...props} dictionariesMap={dictionariesMap} openEditPresetsModal={openEditPresetsModal} />
        <TableFilterChips {...props} labelResolvers={resolvers} />

        <EditPresetsModal visible={visibleEditPresetsModal} closeModal={closeEditPresetsModal} {...props} />
      </Grid>
    </FilterPresetsContextProvider>
  );
};

export const TableFilters = memo(TableFiltersComponent) as typeof TableFiltersComponent & {
  displayName: string;
};
TableFilters.displayName = 'TableFilters';
