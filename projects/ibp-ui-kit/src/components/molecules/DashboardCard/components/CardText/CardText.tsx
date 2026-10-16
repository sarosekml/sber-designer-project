import React, { memo } from 'react';

import { TextMultiRow } from '@/components/atoms';
import { CartTextProps } from '@/components/molecules/DashboardCard/components/CardText/CardText.types';

import { textSx } from './CardText.styles';

export const CardText = memo(({ children }: CartTextProps) => {
  return <TextMultiRow dataTestId={'CardText'} text={children} sx={textSx} lineClamp={'auto'} />;
});

CardText.displayName = 'CardText';
