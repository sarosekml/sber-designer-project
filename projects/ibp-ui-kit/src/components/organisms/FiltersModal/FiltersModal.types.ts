import { FieldValues, ModalProps, UseFormReturn } from '@/components/molecules';

import { FormToDtoConverter, TableFilterModalProps } from '../Tables';

/**
 * This is wrapper for Modal with filter form
 * */
type NecessaryModalType = Pick<
  ModalProps,
  'width' | 'height' | 'closeModal' | 'visible' | 'title' | 'children' | 'contentSx' | 'fullScreen' | 'actionsJustify'
>;

export interface FiltersModalProps<Filter extends object, FormType extends FieldValues> extends NecessaryModalType {
  /**
   * Clear all filters in the form and in the chips too
   * */
  onClear: () => void;
  /**
   * Open modal window
   * */
  onOpenModal: () => void;
  /**
   * Form identifier is necessary for general cases, but if you need to use modal without form,
   * this props will be ignored
   * */
  formId: string;
  /**
   * This is method need to use when you don't use form in the modal,
   * you can control behavior of the component after apply filters
   * */
  onApplyFilters?: () => void;
  /**
   * Disable filters button
   * */
  disabled?: boolean;
  /**
   * Disable submit button if you have validation error.
   * You need to update your state in the parent component,
   * and if you form or custom children component has state with validation error,
   * you can disable submit button
   * */
  isValidationFailed?: boolean;
  /**
   * Add loader for submit button if we have async behavior
   * */
  isSubmitting?: boolean;
  /**
   * Add loader for clear button if we have async behavior
   * */
  isClearing?: boolean;
  /**
   * Localisation for filters chips
   * */
  localization?: FiltersModalLocalization;
  /**
   * Saved filter presets. To enable presets caching you must override the cachingConfig prop of the CacheableTable.
   */
  enablePresets?: boolean;
  staticFilterKeys?: TableFilterModalProps<Filter, FormType>['staticFilterKeys'];
  filterFormMethods: UseFormReturn<any, object>;
  formToDto: FormToDtoConverter<Filter, FormType>;
  openEditPresetsModal: () => void;
}

export interface FiltersModalLocalization {
  title: string;
  clearFilter: string;
  access: string;
  filter: string;
}
