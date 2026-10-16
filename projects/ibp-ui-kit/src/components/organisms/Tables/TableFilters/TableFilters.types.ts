import { TableSettingsCacheLoader } from '@sber-ibp/core';

import { FieldValues } from '@/components/molecules/Inputs';

import { FilterChipConfig } from '../../FiltersChips';

import { TableFilterChipsProps } from './TableFilterChips';
import { TableFilterModalProps } from './TableFilterModal';

/**
 * Experimental type - generates targeted resolver basing on the `dictionaryName`.
 */
export type ExtendedFilterChipConfig<Filter extends object, FormType extends FieldValues> = FilterChipConfig<Filter> & {
  /**
   * The dictionary name which is equal to the attribute name in the form.
   * Is used to generate targeted resolver.
   */
  dictionaryName?: keyof FormType;
  preventResolving?: boolean;
};

/**
 * Experimental type - generates targeted resolver basing on the `dictionaryName`.
 */
export type ExtendedFilterChipsConfig<Filter extends object, FormType extends FieldValues> = Record<
  keyof Filter,
  ExtendedFilterChipConfig<Filter, FormType>
>;

export type ExtendedFilterChipsProps<Filter extends object, FormType extends FieldValues> = Omit<
  TableFilterChipsProps<Filter>,
  'filtersChipsConfig'
> & {
  filtersChipsConfig: ExtendedFilterChipsConfig<Filter, FormType>;
};

export type TableFiltersProps<Filter extends object, FormType extends FieldValues> = Omit<
  TableFilterModalProps<Filter, FormType>,
  'openEditPresetsModal'
> &
  ExtendedFilterChipsProps<Filter, FormType> & { cacheLoader?: TableSettingsCacheLoader };
