import { MouseEvent } from 'react';

import { Dictionary } from '@sber-ibp/core';

import { DictionaryBadgeProps } from '@/components/atoms/DictionaryBadge';
import { DataTestIdProps } from '@/types/common.types';
import { Sx } from '@/utils';

type PrefixObjectProps<T extends object, PropPrefix extends string> = {
  [K in keyof T as K extends string ? `${PropPrefix}${Capitalize<K>}` : K]: T[K];
};

type DictionaryListItemBase = Omit<DictionaryBadgeProps, 'dataTestId' | 'onClick' | 'onDelete'>;
export type DictionaryListItem = Omit<DictionaryListItemBase, 'component'>;
export type DefaultItemProps = PrefixObjectProps<Omit<DictionaryListItemBase, 'code' | 'name'>, 'item'>;

export interface DictionaryListProps extends DataTestIdProps, DefaultItemProps {
  data: DictionaryListItem[];
  /**
   * Defines the number of visible elements.
   * @default undefined (all)
   */
  limit?: number;
  /**
   * Is the same as grid spacing
   * @default 1 (4px)
   */
  spacing?: number;
  /**
   * Sx
   * @default undefined
   */
  sx?: Sx;
  /**
   * Callback which is called in response to item click
   * @default undefined
   */
  onItemClick?: (item: Dictionary, e: MouseEvent) => void;
  /**
   * Callback which is called in response to click delete icon on the item.
   * If not set the cross icon is not appeared
   * @default undefined
   */
  onItemDelete?: (item: Dictionary, e: MouseEvent) => void;
  /**
   * Works if limit is set. Tells whether it possible to see all elements in list or not
   */
  expandable?: boolean;
}
