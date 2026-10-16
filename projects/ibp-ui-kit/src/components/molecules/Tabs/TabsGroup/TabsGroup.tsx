import React, { memo,useMemo } from 'react';
import { Tabs as MaterialTabs } from '@mui/material';

import { getDataTestId, mergeSx } from '@/utils';

import { tabsGroupStyles } from './TabsGroup.styles';
import { TabsProps } from './TabsGroup.types';

export const TabsGroup = memo(
  ({ value, children, onChange, variant = 'standard', dataTestId, orientation = 'horizontal', sx }: TabsProps) => {
    const groupStyle = useMemo(() => mergeSx(tabsGroupStyles(variant, orientation), sx), [variant, orientation, sx]);

    return (
      <MaterialTabs
        data-testid={getDataTestId(dataTestId, 'TabsGroup')}
        indicatorColor="primary"
        textColor="primary"
        aria-label="nav tabs"
        value={value}
        onChange={onChange}
        variant={variant}
        orientation={orientation}
        sx={groupStyle}
      >
        {children}
      </MaterialTabs>
    );
  },
);

TabsGroup.displayName = 'TabsGroup';
