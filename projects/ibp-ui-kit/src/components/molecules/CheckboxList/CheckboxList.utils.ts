import { CheckboxListData } from './CheckboxList.types';

export const isAllItemsSelected: (items: CheckboxListData[]) => boolean = (items) =>
  items.map((it) => it.checked).every((it) => it);

export const isSelectedAtLeastOne: (items: CheckboxListData[]) => boolean = (items) =>
  items.map((it) => it.checked).some((it) => it);
