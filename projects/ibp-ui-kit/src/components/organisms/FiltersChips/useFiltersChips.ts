import { FilterChipResult, FiltersChipsProps } from './FiltersChips.types';
import { useCallback, useMemo, useState } from 'react';
import { constructChipModels } from './FiltersChips.utils';
import { defaultChipsTrimmingLength, defaultFiltersChipsLocalization } from './FiltersChips.const';

export const useFiltersChips = <Filter extends object>({
  filtersChipsConfig,
  filters,
  trimmingLength = defaultChipsTrimmingLength,
  localization = defaultFiltersChipsLocalization,
}: FiltersChipsProps<Filter>) => {
  const [expanded, setExpanded] = useState(false);

  const chipModels = useMemo<FilterChipResult<Filter>[]>(
    () => constructChipModels(filtersChipsConfig, filters, localization),
    [filtersChipsConfig, filters, localization],
  );

  const visibleChipModels = useMemo(() => {
    if (expanded) return chipModels;
    return chipModels.slice(0, trimmingLength);
  }, [chipModels, expanded, trimmingLength]);

  const showAllFilters = useCallback(() => {
    setExpanded(!expanded);
  }, [setExpanded, expanded]);

  return {
    visibleChipModels,
    showAllFilters,
    expanded,
    chipsSize: chipModels.length,
    isEmptyFilters: chipModels.length === 0,
  };
};
