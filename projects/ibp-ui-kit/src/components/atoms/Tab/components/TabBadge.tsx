import React, { memo, useMemo } from 'react';

import { Text } from '@/components/atoms/typography';

import { SxBox } from '../../SxBox';
import { TabProps } from '../Tab.types';

import { getBadgeStyles } from './TabBadge.styles';

type TabBadgeProps = Required<Pick<TabProps, 'size' | 'disabled' | 'iconValue'>>;

export const TabBadge = memo<TabBadgeProps>(({ size, disabled, iconValue }) => {
  const badgeStyles = useMemo(() => getBadgeStyles(size, disabled), [size, disabled]);
  return (
    <SxBox component={'span'} sx={badgeStyles}>
      <Text dataTestId={'Tab_Badge'}>{iconValue}</Text>
    </SxBox>
  );
});
TabBadge.displayName = 'TabBadge';
