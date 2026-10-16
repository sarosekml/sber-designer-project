export type LabeledFilters<Filter extends object> = Record<keyof Filter, string>;

export interface FilterRangeConfig<Filter extends object> {
  from: keyof Filter;
  to: keyof Filter;
}

export interface FilterChipBaseConfig<Filter extends object> {
  label: string;
  /**
   * @deprecated use keys of the original config
   */
  variant?: keyof Filter;
}

export interface FilterChipPlainConfig<Filter extends object> extends FilterChipBaseConfig<Filter> {
  type?: 'basic';
}

export interface FilterChipRangeConfig<Filter extends object> extends FilterChipBaseConfig<Filter> {
  type: 'range-start' | 'range-end';
  relatedFilter: keyof Filter;
}

export type FilterChipConfig<Filter extends object> = FilterChipPlainConfig<Filter> | FilterChipRangeConfig<Filter>;

export type FilterChipsConfig<Filter extends object> = Record<keyof Filter, FilterChipConfig<Filter>>;

export interface FiltersChipsProps<Filter extends object> {
  /**
   * All filters to construct a chips
   * */
  filters: LabeledFilters<Filter>;
  /**
   * Filters chips configuration - general construction in the component
   * */
  filtersChipsConfig: FilterChipsConfig<Filter>;
  /**
   * If `undefined` is provided all filters are removed
   * */
  onClearFilters: (filters?: (keyof Filter)[]) => void;
  /**
   * Length of chips which we can see before expanded
   * @default 3
   * */
  trimmingLength?: number;
  /**
   * Localization for filters chips
   * */
  localization?: FiltersChipsLocalization;
  /**
   * Filter keys that should not be cleared
   */
  staticFilterKeys?: (keyof Filter)[];
}

/**
 * Structure to prepare data for rendering in the FiltersChips component
 * */
export interface FilterChipResult<Filter extends object> {
  /**
   * name - unique identifier for chip
   * */
  filterIds: (keyof Filter)[];
  /**
   * Static chip label
   * */
  label: string;
}

/**
 * Dynamic structure for component localisation from applications
 * */
export interface FiltersChipsLocalization {
  from: string;
  to: string;
  clear: string;
  clearAllFilters: string;
  yes: string;
  no: string;
}
