import React from 'react';
import { Theme } from '@mui/material';

import { Dictionary, i18n, isEmpty } from '@sber-ibp/core';

import { EmptyCellPlaceholder, Text, TextMultiRow, Tooltip } from '@/components/atoms';
import { InputText, InputTextProps } from '@/components/molecules/Inputs';
import { Sx } from '@/utils';

import { MarkerListArgs } from './tableCellUtils.types';
import {
  convertValueToArray,
  getDictionaryData,
  getDictionaryKeyValues,
  isStringsArray,
  multilineSeparator,
} from './tableCellUtils.utils';

/**
 * Util to return EmptyCellPlaceholder if text is empty
 * */
export const noEmptyTextPresenter = ({ value, ...props }: InputTextProps) =>
  value ? (
    <InputText {...props} value={value} size={props.size ?? 'sm'} viewType={props.viewType ?? 'read'} />
  ) : (
    <EmptyCellPlaceholder />
  );

const textSx: Sx = {
  textAlign: 'inherit',
};

/**
 * Util to return EmptyCellPlaceholder if single line text with tooltip is empty
 * */
export const getTextLineWithTooltip = (str: string | undefined, dataTestId?: string) =>
  str ? (
    <Tooltip title={str} dataTestId={dataTestId} trimmingLength={200}>
      <Text type="BodySReg" dataTestId={dataTestId} sx={textSx}>
        {noEmptyTextPresenter({ value: str })}
      </Text>
    </Tooltip>
  ) : (
    <EmptyCellPlaceholder />
  );

/**
 * Util to return EmptyCellPlaceholder if multiline text with tooltip is empty
 * */
export const getTextWithTooltip = (str: string | undefined, dataTestId?: string) =>
  str ? <TextMultiRow dataTestId={dataTestId}>{str}</TextMultiRow> : <EmptyCellPlaceholder />;

/**
 * Util returns 'Yes' or 'No' depends on value. If isUsingDash is true, returns '-' instead 'No'
 * */
export const getBooleanText = (theme: Theme, value?: boolean, isUsingDash?: boolean) =>
  value ? i18n.t('Yes') : isUsingDash ? <EmptyCellPlaceholder /> : i18n.t('No');

/**
 * Unify util to render multiline text with tooltip  from string | string[] | (T extends Dictionary)[]
 *
 * Example 1:
 * value: ['code1', 'code2'], dictionaryKey: 'readiness', dictionaries: stages[],
 * Should use dictionaryData to count final result
 *
 * Example 2:
 * value: stages[], dictionaryKey: 'readiness',
 * Should use value to count final result
 *
 * Example 3:
 * value: ['anyString', 'anyString']
 * Should work branch !dictionaries && isStringsArray(value)
 * */
export const getMultilineText = <T extends Dictionary>({ value, dictionaryKey, dictionaries }: MarkerListArgs<T>) => {
  if (!value || isEmpty(value)) return <EmptyCellPlaceholder />;

  const arrayValue = convertValueToArray(value);
  const dataTestId = String(dictionaryKey);

  if (!dictionaries && isStringsArray(arrayValue)) {
    return getTextWithTooltip(arrayValue.join(multilineSeparator), dataTestId);
  }

  const dictionaryData = dictionaries && isStringsArray(arrayValue) ? getDictionaryData(dictionaries, arrayValue) : [];

  const correctList = isEmpty(dictionaryData) ? (arrayValue as T[]) : dictionaryData;
  const result = getDictionaryKeyValues(correctList, dictionaryKey).join(multilineSeparator);

  return getTextWithTooltip(result, dataTestId);
};
