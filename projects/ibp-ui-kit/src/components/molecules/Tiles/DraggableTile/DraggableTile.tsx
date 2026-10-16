import React from 'react';
import { Card, useTheme } from '@mui/material';

import { Grid } from '@/components/atoms';
import { IconButton } from '@/components/atoms/IconButton';
import { TileHeader } from '@/components/molecules/Tiles/TileHeader';
import { getDataTestId, mergeSx } from '@/utils';

import { DraggableTileProps } from '../TilesTypes';

import { useChildrenStyles, useStyles } from './DraggableTile.styles';

export const DraggableTile = React.memo<DraggableTileProps>(
  ({ title, subtitle, dataTestId, isDisabled = false, onDoubleClick, children, sx }) => {
    const theme = useTheme();
    const stylesSx = useStyles({ theme, isDisabled });
    const childrenSx = useChildrenStyles({ theme, isDisabled });

    return (
      <Card
        variant={'outlined'}
        onDoubleClick={onDoubleClick}
        data-testid={getDataTestId(dataTestId, 'Tile')}
        sx={mergeSx(stylesSx, sx)}
      >
        <TileHeader
          title={title}
          dataTestId={getDataTestId(dataTestId, 'TileHeader')}
          subtitle={subtitle}
          size={'sm'}
          actions={
            <IconButton
              dataTestId={getDataTestId(dataTestId, 'TileIconButton')}
              name={'DragDots'}
              disabled={isDisabled}
            />
          }
        />
        <Grid container sx={childrenSx}>
          {children}
        </Grid>
      </Card>
    );
  },
);

DraggableTile.displayName = 'DraggableTile';
