import React from 'react';

import { Grid } from '@/components/atoms';
import { DashboardGroupHeader } from '@/components/atoms/Header';
import { DashboardCard } from '@/components/molecules/DashboardCard';

import { CardData, CardProps } from '.';

export interface DashboardColumnProps {
  cards: CardProps[];
  index: number;
  onCardClick: (card: CardData) => void;
  title?: string;
}

export const DashboardColumn = ({ title, index, cards, onCardClick }: DashboardColumnProps) => {
  if (!cards?.length) return null;
  return (
    <Grid
      key={`title-${index}`}
      container
      item
      direction="column"
      sizes={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 3 }}
      sx={{ flexGrow: 1 }}
    >
      {title && (
        <DashboardGroupHeader dataTestId="Data" sx={{ px: 0, py: 2 }}>
          {title}
        </DashboardGroupHeader>
      )}
      <Grid item container spacing={4} sx={{ flexDirection: 'column', flexWrap: 'nowrap' }}>
        {cards.map((card, index) => (
          <Grid item key={index}>
            <DashboardCard {...card} onCardClick={() => onCardClick(card)} />
          </Grid>
        ))}
      </Grid>
    </Grid>
  );
};
