/* eslint-disable @typescript-eslint/ban-types */
import { LabeledFilters } from '../../../FiltersChips/FiltersChips.types';

import { isDictionaryArray } from './TableFilterChips.resolvers';
import {
  FilterLabelResolver,
  isTargetedResolver,
  isUniversalResolver,
  TargetedResolver,
  UniversalResolver,
} from './TableFilterChips.types';

const commaSeparator = ', ';

const makeArrayResolver =
  <FilterValue>(resolver: UniversalResolver<FilterValue>) =>
  (value: FilterValue[], hint?: string) => {
    return Array.isArray(value) ? value.map((value) => resolver(value, hint)).join(commaSeparator) : null;
  };

const makeUniversalResolver = <Filter extends object>(allResolvers: FilterLabelResolver<Filter>[]) => {
  const resolvers: UniversalResolver<Filter>[] = allResolvers.filter((it) =>
    isUniversalResolver(it),
  ) as unknown as UniversalResolver<Filter>[];

  return (filter: Filter[keyof Filter], hint?: string): string => {
    for (const resolver of resolvers) {
      // eslint-disable-next-line
      // @ts-ignore
      const result = resolver(filter, hint) ?? makeArrayResolver(resolver)(filter, hint);
      if (result) {
        return result;
      }
    }
    return JSON.stringify(filter);
  };
};

const makeResolversMap = <Filter extends object>(allResolvers: FilterLabelResolver<Filter>[]) => {
  return new Map(
    (allResolvers.filter((it) => isTargetedResolver(it)) as TargetedResolver<Filter>[]).map((it) => [it.target, it]),
  );
};

export const resolveLabels = <Filter extends object>(
  filters: Filter,
  resolvers: FilterLabelResolver<Filter>[],
): LabeledFilters<Filter> => {
  const entries = new Map<keyof Filter, string>();
  const resolversMap = makeResolversMap(resolvers);
  const universalResolver = makeUniversalResolver(resolvers);

  for (const filterKey in filters) {
    if (filterKey in filters) {
      const filterValue = filters[filterKey];
      const targetedResolver = resolversMap.get(filterKey);
      const label = targetedResolver
        ? targetedResolver.resolve(filterValue)
        : universalResolver(filterValue, filterKey);

      entries.set(filterKey, label);
    }
  }
  return Object.fromEntries(entries) as LabeledFilters<Filter>;
};
