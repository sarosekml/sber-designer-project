import React, { memo } from 'react';
import { DictionaryBadge } from '../../DictionaryBadge';
import { ValueBadgeProps } from './ValueBadge.types';

/**
 * Most of the time it's enough to use ValueBadge, if you have only value and
 * no need to use code in the click-callbacks, otherwise if you want to
 * show exactly the Dictionary dto you can use DictionaryBadge as:
 * @example
 * <DictionaryBadge component="Marker" {...dictionary}/>
 * @example
 * <ValueBadge component="Marker" value={someValue}/>
 */
export const ValueBadge = memo(({ value, ...props }: ValueBadgeProps) => {
  const stringValue = `${value}`;
  return <DictionaryBadge {...props} code={stringValue} name={stringValue} />;
});

ValueBadge.displayName = 'ValueBadge';
