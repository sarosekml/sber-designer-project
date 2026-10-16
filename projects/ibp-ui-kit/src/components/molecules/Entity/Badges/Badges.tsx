import React from 'react';
import { Grid } from '@mui/material';

import { DictionaryBadge, Text } from '@/components/atoms';

import { useNotFitCount } from '../Entity.hooks';
import { BadgesProps, EntitySize } from '../Entity.types';
import { getSubTextSize } from '../Entity.utils';

export interface Props {
  badges?: BadgesProps;
  size?: EntitySize;
}

export const Badges = ({ size = 'lg', badges }: Props) => {
  if (!badges) {
    return null;
  }

  const notFitCount = useNotFitCount(badges?.items.length, badges?.max, badges?.countBadge?.showPlus);

  return (
    <Grid container gap={1} alignItems="center">
      {badges.items.slice(0, badges?.max || badges.items.length).map((item, index) => (
        <DictionaryBadge
          key={index}
          variant="outlined"
          type="read"
          size={badges?.badge?.size || 'sm'}
          component={badges?.badge?.component || 'Marker'}
          name={item}
          code={item}
          hoverable={false}
          colorThemeSx={badges?.badge?.colorThemeSx}
        />
      ))}
      {badges?.max &&
        badges.items.length > badges?.max &&
        (badges?.countBadge?.type === 'transparent' ? (
          <Text type={getSubTextSize(size)}>{notFitCount}</Text>
        ) : (
          <DictionaryBadge
            variant="outlined"
            type="read"
            size={badges?.badge?.size || 'sm'}
            component="Marker"
            name={notFitCount}
            code={notFitCount}
            hoverable={false}
            colorThemeSx={badges?.countBadge?.colorThemeSx}
          />
        ))}
    </Grid>
  );
};
