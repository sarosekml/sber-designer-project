import {
  FilterChipConfig,
  FilterChipRangeConfig,
  FilterChipResult,
  FilterChipsConfig,
  FiltersChipsLocalization,
  LabeledFilters,
} from './FiltersChips.types';

const emptyString = '';

export const isFilterRangeConfig = <Filter extends object>(
  config: FilterChipConfig<Filter>,
): config is FilterChipRangeConfig<Filter> => config.type === 'range-end' || config.type === 'range-start';

export const getValueForRangeFiltersChip = (
  localization: FiltersChipsLocalization,
  valueFrom?: string,
  valueTo?: string,
): string => {
  if (!valueFrom && !valueTo) return emptyString;

  if (valueFrom && valueTo) return `${localization.from} ${valueFrom} ${localization.to} ${valueTo}`;
  if (valueFrom) return `${localization.from} ${valueFrom}`;
  if (valueTo) return `${localization.to} ${valueTo}`;
  return emptyString;
};

export const clearTableFilters = <Filter>(filterIds: (keyof Filter)[], filters: Filter) => {
  return {
    ...filters,
    ...Object.fromEntries(filterIds.map((id) => [id, undefined])),
  };
};

export const constructChipModels = <Filter extends object>(
  filtersChipsConfig: FilterChipsConfig<Filter>,
  filters: LabeledFilters<Filter>,
  localization: FiltersChipsLocalization,
) => {
  const processedRanges = new Set<keyof Filter>();
  const models: FilterChipResult<Filter>[] = [];

  for (const key in filtersChipsConfig) {
    const config = filtersChipsConfig[key];
    const filterId = config.variant ?? key;

    const valueLabel = filters[filterId];
    if (!valueLabel) continue;

    if (isFilterRangeConfig(config)) {
      if (!processedRanges.has(filterId)) {
        processedRanges.add(config.relatedFilter);
        const fromId = config.type === 'range-start' ? filterId : config.relatedFilter;
        const toId = config.type === 'range-end' ? filterId : config.relatedFilter;
        models.push({
          filterIds: [filterId, config.relatedFilter],
          label: `${config.label}: ${getValueForRangeFiltersChip(localization, filters[fromId], filters[toId])}`,
        });
      }
    } else {
      models.push({ filterIds: [filterId], label: `${config.label}: ${valueLabel}` });
    }
  }
  return models;
};
