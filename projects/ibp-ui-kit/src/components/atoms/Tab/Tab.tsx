import React, { memo, useMemo } from 'react';
import { Tab as MaterialTab } from '@mui/material';

import { mergeSx } from '@/utils';

import { TabBadge } from './components/TabBadge';
import { getTabStyles } from './Tab.styles';
import { TabProps } from './Tab.types';

export const Tab = memo<TabProps>(
  ({
    size = 'md',
    value,
    label,
    dataTestId,
    disabled = false,
    disableRipple,
    sx,
    iconValue,
    orientation = 'horizontal',
    icon,
    textAlign = 'left',
    ...props
  }) => {
    const hasIconValue = iconValue !== undefined;

    const tabStyles = useMemo(
      () => mergeSx(getTabStyles(size, orientation, textAlign, hasIconValue), sx),
      [size, orientation, textAlign, hasIconValue, sx],
    );

    const testId = `${dataTestId ?? value}_Tab`;

    return (
      <MaterialTab
        data-testid={testId}
        disabled={disabled}
        disableRipple={disableRipple}
        label={label}
        value={value}
        sx={tabStyles}
        disableTouchRipple
        icon={hasIconValue ? <TabBadge size={size} iconValue={iconValue} disabled={disabled} /> : icon}
        iconPosition={'end'}
        {...props}
      />
    );
  },
);

Tab.displayName = 'Tab';
