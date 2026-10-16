import React from 'react';

import { Dictionary, isEmpty } from '@sber-ibp/core';

import { EmptyCellPlaceholder, Grid, Tooltip, ValueBadge } from '@/components/atoms';
import {
  cutTooltipData,
  ListCounter,
  prepareArrayForColumnView,
  prepareArrayForRowView,
} from '@/components/atoms/Counter';

import { MarkerListArgs } from './tableCellUtils.types';
import { convertValueToArray, getDictionaryData, getDictionaryKeyValues, isStringsArray } from './tableCellUtils.utils';

/**
 * Unify util to render marker list from string | string[] | (T extends Dictionary)[]
 *
 * Example 1:
 * value: ['code1', 'code2'], dictionaryKey: 'readiness', dictionaries: stages[],
 * Should work branch -> dictionaries && isStringsArray(value)
 *
 * Example 2:
 * value: stages[], dictionaryKey: 'readiness',
 * Should work branch -> !dictionaries || (dictionaries && !isStringsArray(value))
 * If you add dictionaries props with value as Dictionary, dictionaries will be ignored.
 * */
export const getMarkersList = <T extends Dictionary>({
  value,
  dictionaryKey,
  dictionaries,
  cutLength = 2,
  isTooltipColumnView = false,
}: MarkerListArgs<T>) => {
  if (!value || isEmpty(value)) return <EmptyCellPlaceholder />;
  const _value = convertValueToArray(value);
  let result: string[] = [];
  if (!dictionaries || (dictionaries && !isStringsArray(_value))) {
    result = isStringsArray(_value) ? _value : getDictionaryKeyValues(_value, dictionaryKey);
  }
  if (dictionaries && isStringsArray(_value)) {
    result = getDictionaryKeyValues(getDictionaryData(dictionaries, _value), dictionaryKey);
  }

  const tooltipTitle = isTooltipColumnView
    ? prepareArrayForColumnView(cutTooltipData(result, cutLength))
    : prepareArrayForRowView(cutTooltipData(result, cutLength));

  return (
    <Grid container gap={1}>
      {result.slice(0, cutLength)?.map((it, index) => {
        const key = it + index;
        return <ValueBadge value={it} dataTestId={key} key={key} size={'sm'} component={'Marker'} />;
      })}
      <Grid item>
        <Tooltip title={tooltipTitle}>
          <ListCounter count={result.length} cutCount={cutLength} size={'sm'} />
        </Tooltip>
      </Grid>
    </Grid>
  );
};
