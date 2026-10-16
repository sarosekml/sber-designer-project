import { ReactNode } from 'react';

import { DataTestIdProps } from '@/types';
import { Sx } from '@/utils';

interface CommonTabPanelProps extends DataTestIdProps {
  sx?: Sx;
  children?: ReactNode;
}

export type TabPanelProps = CommonTabPanelProps & {
  currentTab: string;
  /**
   * if currentTab === tabName, then content will be visible
   */
  tabName: string;
};
