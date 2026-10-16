import React, { FC, memo } from 'react';

import { getDataTestId } from '@/utils';

import { Grid } from '../Grid';

import { getGridStyles } from './GridTileContainer.styles';
import { GridTileContainerProps } from './GridTileContainer.types';

export const GridTileContainer: FC<GridTileContainerProps> = memo(
  ({
    alignContent = 'stretch',
    alignItems = 'stretch',
    justify = 'flex-start',
    direction = 'row',
    spacing = 2,
    className,
    children,
    stretchAll,
    sizes,
    dataTestId,
  }) => {
    const gridStyles = getGridStyles({ stretchAll });

    return (
      <Grid
        alignContent={alignContent}
        alignItems={alignItems}
        justifyContent={justify}
        direction={direction}
        spacing={spacing}
        className={className}
        data-testid={getDataTestId(dataTestId, 'GridTileContainer')}
        container
        item
        sizes={sizes}
        sx={gridStyles}
      >
        {children}
      </Grid>
    );
  },
);

GridTileContainer.displayName = 'GridTileContainer';
