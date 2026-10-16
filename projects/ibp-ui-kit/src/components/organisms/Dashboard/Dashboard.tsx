import React, { memo } from 'react';

import { Grid } from '@/components/atoms';
import { Sx } from '@/utils';

import { CardData, ColumnData } from './Dashboard.types';
import { DashboardColumn } from './DashboardColumn';

export interface DashboardProps {
  dashboardData: ColumnData[];
  dataTestId: string;
  onCardClick: (card: CardData) => void;
}

const dashboardRootStyles: Sx = {
  alignItems: 'flex-start',
  flexDirection: { xs: 'column', sm: 'row' },
  flexWrap: { xs: 'nowrap', sm: 'wrap' },
  justifyContent: 'flex-start',
  maxWidth: '1784px',
};

export const Dashboard = memo<DashboardProps>(({ dashboardData, dataTestId, onCardClick }) => {
  if (!dashboardData?.length) return null;
  return (
    <Grid container spacing={3} sx={dashboardRootStyles} dataTestId={dataTestId}>
      {dashboardData.map(({ title, cards }, index) => (
        <DashboardColumn key={index} cards={cards} index={index} title={title} onCardClick={onCardClick} />
      ))}
    </Grid>
  );
});

Dashboard.displayName = 'Dashboard';
