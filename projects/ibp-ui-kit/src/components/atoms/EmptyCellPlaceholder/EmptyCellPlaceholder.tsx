import React, { memo } from 'react';

import { dashSymbol } from '@sber-ibp/core';

import { Text } from '@/components/atoms/typography/Text/Text';
import { Sx } from '@/utils';

const placeholderTextSx: Sx = (theme) => ({ textAlign: 'inherit', color: theme.palette.Text.TextInactive });

/**
 * this component is intended for use in table cells
 * as a filler for empty cells
 * with a dash or another symbol or even space
 */
export const EmptyCellPlaceholder = memo(() => {
  return <Text sx={placeholderTextSx}>{dashSymbol}</Text>;
});

EmptyCellPlaceholder.displayName = 'EmptyCellPlaceholder';
