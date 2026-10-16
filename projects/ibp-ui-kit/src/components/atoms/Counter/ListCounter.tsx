import React, { memo } from 'react';

import { Counter } from './Counter';
import { ListCounterProps } from './Counter.types';

export const ListCounter = memo(
  ({
    dataTestId = 'Counter',
    count,
    cutCount,
    size = 'md',
    type = 'edit',
    variant = 'transparent',
    sx,
  }: ListCounterProps) => {
    if (count < 0 || count < cutCount) return null;

    const counterText = count > cutCount && `+${count - cutCount}`;

    return counterText ? (
      <Counter dataTestId={dataTestId} count={counterText} size={size} type={type} variant={variant} sx={sx} />
    ) : null;
  },
);

ListCounter.displayName = 'ListCounter';
