import { ChangeEvent, SetStateAction } from 'react';

import { BaseInputProps, InputViewType } from '../InternalComponents/BaseInput/BaseInput.types';
/**
 * text - type using only with multiple === false for single item
 * chip and marker - types using only multiple === true for multiple items
 * single - тип для dictionary + count + dictionaryBadge
 */
export type InputAutocompleteViewFormat = 'chip' | 'outerChip' | 'marker' | 'text';

export type InputAutocompleteInternalValueType<T, Multiple extends boolean> = (Multiple extends true ? T[] : T) | null;

export interface InputAutocompleteMultipleOptions<T> {
  /**
   * How many items will be visible after blur of component
   */
  visibleItemsCount?: number;
  /**
   * Values which can not be removed
   */
  staticValues?: T[];
  /**
   * Tooltip for watching items in the counter if you not focus to the component
   */
  showTooltipForHideTags?: boolean;
}

export type ValueComparator<T> = (option1: T, option2: T) => boolean;

export interface InputAutocompleteAsyncOptions<T> {
  isLoading: boolean;
  /**
   * Function which will call inside the component and return result to the options
   */
  loadData: (searchKey: string) => Promise<T[]>;
  /**
   * How many time system will wait for starting call function - loadData
   * @default 500ms
   */
  userInputDelay?: number;
  /**
   * How many symbols need to input for starting call function - loadData
   * @default 3
   */
  minSearchCount?: number;
}

export type InputAutocompleteChangeCallback<T, Multiple extends boolean> = (
  value: InputAutocompleteInternalValueType<T, Multiple>,
  event?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

export interface InputAutocompleteProps<T, Multiple extends boolean>
  extends Pick<
    BaseInputProps,
    | 'size'
    | 'disabled'
    | 'onInfo'
    | 'postfix'
    | 'prefix'
    | 'label'
    | 'startAction'
    | 'dataTestId'
    | 'infoOptions'
    | 'labelOptions'
    | 'helperText'
    | 'validationOptions'
    | 'name'
    | 'isColoredBg'
    | 'autoFocus'
    | 'placeholder'
    | 'errorTooltip'
  > {
  updateOnCloseDropdown?: boolean;
  options?: T[];
  getOptionLabel: (option: T) => string;
  getOptionIdentifier?: (option: T) => string;
  onChange?: InputAutocompleteChangeCallback<T, Multiple>;
  onInputChange?: (event: Partial<ChangeEvent<HTMLInputElement | HTMLTextAreaElement>>, newValue?: string) => void;
  optionsGroupBy?: (option: T) => string;
  /** @deprecated use getOptionIdentifier prop*/
  isOptionEqualToValue?: ValueComparator<T>;
  renderOptions?: (option: T) => React.ReactNode;
  renderTags?: (value: T[]) => React.ReactNode;
  /**
   * Properties which necessary for loading options with async logic
   *  */
  asyncOptions?: InputAutocompleteAsyncOptions<T>;
  getOptionDisabled?: (option: T) => boolean;
  /**
   * @default false
   */
  multiple?: Multiple;
  /**
   * Type of input view for reading/editing of the value
   * @default 'edit'
   */
  viewType?: InputViewType;
  /** Format of values for multiple variants
   * text - multiple === false
   * @default 'text'
   * chip | marker - multiple === true
   * @default 'chip'
   */
  viewFormat?: InputAutocompleteViewFormat;
  value: InputAutocompleteInternalValueType<T, Multiple>;
  /**
   * Properties which necessary multiple === true.
   * This properties not working with multiple === false
   *  */
  multipleOptions?: Multiple extends true ? InputAutocompleteMultipleOptions<T> : never;
  /**
   * @default true
   */
  hasClearIndicator?: boolean;
  /**
   * It's used to filter out some options
   * @default undefined
   */
  filterOptions?: (options: T[]) => T[];
  hasSelectAll?: boolean;
}

export interface OptionsDataByRequestProps<T> {
  value: string;
  setInternalOptions: (value: SetStateAction<T[]>) => void;
  setIsError: (error: SetStateAction<boolean>) => void;
  setIsResponded: (error: SetStateAction<boolean>) => void;
  asyncOptions?: InputAutocompleteAsyncOptions<T>;
}
