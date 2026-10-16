import { DictionaryListProps } from '../../DictionaryList.types';

export interface ValueListProps extends Omit<DictionaryListProps, 'data'> {
  data: (string | number)[];
}
