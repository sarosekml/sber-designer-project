import { ReactElement } from 'react';

import { DashboardCardData } from '@/components/molecules/DashboardCard';
import { DataTestIdProps } from '@/types';

export const DASHBOARD_COLUMNS_COUNT = 4;

export interface CardData extends DashboardCardData {
  access: boolean;
  isExternal?: boolean;
  url: string;
  /** Statistic options for ClickStream lib */
  statisticOptions?: {
    cardName: string;
    nameOfScreenDisplayingCard: string;
  };
}

export interface CardProps extends CardData, DataTestIdProps {
  render?: (data: CardData) => ReactElement | string;
}

export interface ColumnData {
  cards: CardProps[];
  title?: string;
}
