import { GridProps } from '@/components/atoms/gridTiles/Grid/Grid.types';

import { FilterRange } from '../../molecules';

import { FieldParams, FormTemplate } from './FormConstructor.types';

export const nameToString = (fieldName: string | number | symbol) => String(fieldName);

const isExistedArray = (value: any): value is Array<unknown> => value && Array.isArray(value);
export const isRangeValue = (range: any): range is FilterRange =>
  Boolean(range) && typeof range === 'object' && 'from' in range && 'to' in range;

export const countFilterFormValuesByTabs = <T>(filterTemplate: FormTemplate<T>, watcher: T) =>
  filterTemplate.forms.reduce<Record<keyof T, number>>((tabCounterMap, form) => {
    const activeFiltersCount = form.fieldList
      .map((field) => watcher?.[field.name])
      .filter(Boolean)
      .reduce((sum, fieldValue) => {
        let resultSum = sum;
        if (isExistedArray(fieldValue)) {
          resultSum += fieldValue.length;
        } else if (isRangeValue(fieldValue)) {
          resultSum += (fieldValue.from ? 1 : 0) + (fieldValue.to ? 1 : 0);
        } else {
          resultSum++;
        }
        return resultSum;
      }, 0);
    return { ...tabCounterMap, [form.tabKey]: activeFiltersCount };
  }, {} as Record<keyof T, number>);

export const getInputGridProps = <T>(field: FieldParams<T>): GridProps => {
  const checkboxGridProps: GridProps = {
    display: 'flex',
    alignItems: 'center',
    item: true,
    sizes: field.sizes,
  };
  const otherGridProps: GridProps = {
    item: true,
    sizes: field.sizes,
  };
  return field.inputType === 'checkbox' ? checkboxGridProps : otherGridProps;
};
