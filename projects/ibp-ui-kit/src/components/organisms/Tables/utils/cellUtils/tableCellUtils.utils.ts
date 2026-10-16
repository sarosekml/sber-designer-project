import { LocalTableRowData } from './tableCellUtils.types';
import { isEmpty, Dictionary } from '@sber-ibp/core';

export const multilineSeparator = '; ';

/**
 * Additional utils for exclude boilerplate.
 * */
export const isStringsArray = (array: unknown[]): array is string[] => array.every((it) => typeof it === 'string');
export const convertValueToArray = <T extends Dictionary>(value: LocalTableRowData<T>) => {
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  return value;
};

export const getDictionaryKeyValues = <T extends Dictionary>(values: T[], dictionaryKey: keyof T = 'name') =>
  values.map<string>((it) => it[dictionaryKey] as unknown as string);

export const getDictionaryData = <DIC extends Dictionary, CODE>(dictionary: DIC[], dictionaryCodes: CODE[]) => {
  if (isEmpty(dictionaryCodes)) return [];
  return dictionary.filter((it) => dictionaryCodes.includes(it.code as unknown as CODE));
};
