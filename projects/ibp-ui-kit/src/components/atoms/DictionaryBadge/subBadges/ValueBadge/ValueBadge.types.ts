import { DictionaryBadgeProps } from '../../DictionaryBadge.types';

export interface ValueBadgeProps extends Omit<DictionaryBadgeProps, 'code' | 'name'> {
  value: string | number;
}
