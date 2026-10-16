import { Dictionary, IsoDate } from '@sber-ibp/core';

import { isCorrectDateFormat } from '@/components/molecules';
import { isoDateToViewString } from '@/components/molecules/Inputs/InputDate/InputDateUtils';

import { BaseData } from '../../Table/TableProps';

import { UniversalResolver } from './TableFilterChips.types';

const isBoolean = (value: unknown): value is boolean => value === !!value;
const getBooleanLabel: UniversalResolver<boolean> = (value) => (value ? 'Да' : 'Нет');
export const booleanResolver: UniversalResolver = (value) => {
  if (isBoolean(value)) return getBooleanLabel(value);
  return null;
};

const isBaseData = (value: unknown): value is BaseData => ['string', 'number'].some((it) => it === typeof value);
const getBaseDataLabel: UniversalResolver<BaseData> = (value) => `${value}`;
export const baseDataResolver: UniversalResolver = (value) => {
  if (isBaseData(value)) return getBaseDataLabel(value);
  return null;
};

export const isDictionary = (value: unknown): value is Dictionary =>
  value !== null &&
  typeof value === 'object' &&
  'name' in value &&
  'code' in value &&
  typeof value['name'] === 'string';
export const isDictionaryArray = (value: unknown): value is Dictionary[] =>
  Array.isArray(value) && value.every(isDictionary);

const getDictionaryLabel: UniversalResolver<Dictionary> = (value) => value.name;
export const dictionaryResolver: UniversalResolver = (value) => {
  if (isDictionary(value)) return getDictionaryLabel(value);
  return null;
};

const isIsoDate = (value: unknown): value is IsoDate => typeof value === 'string' && isCorrectDateFormat(value, 'iso');
const getIsoDateLabel: UniversalResolver<IsoDate> = (value) => isoDateToViewString(value, 'ru');
export const isoDateResolver: UniversalResolver = (value) => {
  if (isIsoDate(value)) return getIsoDateLabel(value);
  return null;
};

export const defaultLabelResolvers: UniversalResolver<any>[] = [
  booleanResolver,
  baseDataResolver,
  dictionaryResolver,
  isoDateResolver,
];
