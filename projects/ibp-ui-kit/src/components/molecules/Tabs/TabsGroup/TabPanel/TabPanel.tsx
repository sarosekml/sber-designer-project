import React, { memo, useMemo } from 'react';

import { SxBox } from '@/components/atoms';
import { getDataTestId, mergeSx } from '@/utils';

import { tabPanelStyles } from './TabPanel.styles';
import { TabPanelProps } from './TabPanel.types';

/**
 * It is a part of TabsGroup component for content
 */
export const TabPanel = memo<TabPanelProps>(({ children, sx, dataTestId, tabName, currentTab }) => {
  const mergedSx = useMemo(() => mergeSx(tabPanelStyles, sx), [sx]);

  return (
    <SxBox
      data-testid={getDataTestId(dataTestId, 'TabPanel')}
      sx={mergedSx}
      role="tabpanel"
      hidden={currentTab !== tabName}
    >
      {children}
    </SxBox>
  );
});

TabPanel.displayName = 'TabPanel';
