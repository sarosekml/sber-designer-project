import React, { useMemo } from 'react';

import { DictionaryList } from '../../DictionaryList';
import { ValueListProps } from './ValueList.types';

/**
 * Most of the time it's enough to use ValueList, if you have only values and
 * no need to use code in the click-callbacks, otherwise if you want to
 * show exactly the list of Dictionary items dto you can use DictionaryList as:
 * @example
 * <DictionaryList data={[{code: '1', name: '1'}, {code: '2', name: '2'}]}/>
 * @example
 * <ValueList data={[1, 2, 3, 'hello']}/>
 */
export const ValueList = ({ data: plainData, ...props }: ValueListProps) => {
  const data = useMemo(() => plainData.map((it) => ({ code: `${it}`, name: `${it}` })), [plainData]);
  return <DictionaryList {...props} data={data} />;
};

ValueList.displayName = 'ValueList';
