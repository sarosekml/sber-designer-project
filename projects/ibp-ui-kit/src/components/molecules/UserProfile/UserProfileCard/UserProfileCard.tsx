import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

import { getDataTestId } from '@/utils';

import { UserProfileCardProps } from './UserProfileCard.types';

export const UserProfileCard = React.memo(({ data, text, classes, dataTestId }: UserProfileCardProps) => {
  return (
    <Card data-testid={getDataTestId(dataTestId, 'UserProfileCard')} className={classes}>
      <CardContent>
        <Typography color="textSecondary">{text}</Typography>
        <Typography>{data}</Typography>
      </CardContent>
    </Card>
  );
});
