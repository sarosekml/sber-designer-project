/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

import { FiltersChipsProps, LabeledFilters } from '@/components/organisms/FiltersChips/FiltersChips.types';

export type TargetedResolver<Filter extends object, FilterName extends keyof Filter = keyof Filter> = {
  resolve: (value: Filter[FilterName]) => string;
  target: FilterName;
};

type TargetedLabelResolverUnion<Filter extends object, FilterName extends keyof Filter> = FilterName extends any
  ? TargetedResolver<Filter, FilterName>
  : never;

export type TargetedLabelResolver<Filter extends object> = TargetedLabelResolverUnion<Filter, keyof Filter>;

/**
 * @param `hint` - filter attribute name to resolve label correctly depending on the different attributes,
 * generally the prop is a hack for heuristic approach
 */
export type UniversalResolver<FilterValue = any> = (value: FilterValue, hint?: string) => string | null;

export type FilterLabelResolver<Filter extends object> =
  | TargetedLabelResolver<Filter>
  | UniversalResolver<Filter[keyof Filter]>;

// eslint-disable-next-line @typescript-eslint/ban-types
export interface TableFilterChipsProps<Filter extends object>
  extends Pick<FiltersChipsProps<Filter>, 'localization' | 'filtersChipsConfig'> {
  emptyFilters: Filter;
  labelResolvers?: FilterLabelResolver<Filter>[];
  tableCode: string;
  staticFilterKeys?: (keyof Filter)[];
  onCustomClearFilters?: (filterIds?: (keyof LabeledFilters<Filter>)[]) => void;
}

export const isTargetedResolver = <Filter extends object>(
  resolver: FilterLabelResolver<Filter>,
): resolver is TargetedLabelResolver<Filter> => typeof resolver === 'object';

export const isUniversalResolver = <Filter extends object>(
  resolver: FilterLabelResolver<Filter>,
  // eslint-disable-next-line
  // @ts-ignore
): resolver is UniversalResolver<Filter> => typeof resolver === 'function';
