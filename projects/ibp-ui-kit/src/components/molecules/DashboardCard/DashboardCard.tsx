import React, { memo } from 'react';

import { Grid, Paper, Text } from '@/components/atoms';
import { CardText } from '@/components/molecules/DashboardCard/components/CardText/CardText';
import { DashboardCardProps } from '@/components/molecules/DashboardCard/DashboardCard.types';

import { getDashBoardStyles, getСardTextContentStyles, iconSx, titleSx } from './DashboardCard.styles';

export const DashboardCard = memo(
  ({ title, text, links, disabled, dataTestId = 'DashboardCard', icon: Icon, onCardClick }: DashboardCardProps) => {
    const dashBoardStyles = getDashBoardStyles({ disabled });
    const cardTextContentStyle = getСardTextContentStyles(!!Icon);

    return (
      <Paper key={title} elevation={0} sx={dashBoardStyles} onClick={onCardClick} dataTestId={dataTestId}>
        <Grid item sx={cardTextContentStyle}>
          <Text type="H4StrongExtensiveSmb" sx={titleSx} dataTestId="Subtitle">
            {title}
          </Text>
          <CardText>{text}</CardText>
          {links}
        </Grid>
        {Icon && <Icon sx={iconSx} />}
      </Paper>
    );
  },
);

DashboardCard.displayName = 'DashboardCard';
