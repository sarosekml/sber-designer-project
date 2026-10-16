import React, { ReactNode } from 'react';
import { Grid, useTheme } from '@mui/material';

import { DictionaryBadge, Text } from '@/components/atoms';

import { useNotFitCount } from '../Entity.hooks';
import { EntitySize, SubHeaderProps } from '../Entity.types';
import { getSubTextSize } from '../Entity.utils';

export interface Props {
  subHeader?: SubHeaderProps;
  subHeaderPrefix?: ReactNode;
  size?: EntitySize;
}

export const SubHeader = ({ size = 'lg', subHeader, subHeaderPrefix }: Props) => {
  const theme = useTheme();

  if (!subHeader) {
    return null;
  }

  const notFitCount = useNotFitCount(subHeader?.items.length, subHeader?.max, subHeader?.countBadge?.showPlus);

  return (
    <Grid container gap={1} alignItems="center">
      {subHeaderPrefix}
      <Text type={getSubTextSize(size)} color={theme.palette.Text.TextOnTertiary}>
        {subHeader.items.slice(0, subHeader?.max || subHeader.items.length).join(', ')}
      </Text>
      {subHeader?.max &&
        subHeader.items.length > subHeader?.max &&
        (subHeader?.countBadge?.type === 'transparent' ? (
          <Text type={getSubTextSize(size)}>{notFitCount}</Text>
        ) : (
          <DictionaryBadge
            variant="outlined"
            type="read"
            size={subHeader?.countBadge?.size || 'sm'}
            component="Marker"
            name={notFitCount}
            code={notFitCount}
            hoverable={false}
            colorThemeSx={subHeader?.countBadge?.colorThemeSx}
          />
        ))}
    </Grid>
  );
};
