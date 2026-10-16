import React, { useMemo } from 'react';

import { Grid } from '@/components/atoms';
import { getDataTestId, mergeSx } from '@/utils';

import { TileProps } from '../TilesTypes';

import { getTileWrapperStyles } from './Tile.styles';
import { TileCard } from './TileCard';

export const Tile = React.memo<TileProps>(
  ({ dataTestId, gridSizes = { xs: 12 }, sx, scrollEnabled = false, ...cardProps }) => {
    const tileWrapperStyle = useMemo(
      () => (scrollEnabled ? mergeSx(sx, getTileWrapperStyles()) : sx),
      [scrollEnabled, sx],
    );

    return (
      <Grid item sizes={gridSizes} data-testid={getDataTestId(dataTestId, 'TileGrid')} sx={tileWrapperStyle}>
        <TileCard dataTestId={dataTestId} scrollEnabled={scrollEnabled} {...cardProps} />
      </Grid>
    );
  },
);

Tile.displayName = 'Tile';
