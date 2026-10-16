import React, { useMemo } from 'react';
import { Card, CardContent } from '@mui/material';

import { TileHeader } from '@/components/molecules/Tiles/TileHeader';
import { getDataTestId, mergeSx } from '@/utils';

import { TileCardProps } from '../../TilesTypes';

import { alertContentStyle, getTileContentStyles, getTileStyles } from './TileCard.styles';

export const TileCard = React.memo(
  ({
    isHighlighted = false,
    title,
    subtitle,
    dataTestId,
    titlePostfix,
    subtitlePostfix,
    actions,
    children,
    alert,
    headless = false,
    size = 'lg',
    variant = 'elevation',
    onDoubleClick,
    sx,
    hasSpot,
    scrollEnabled = false,
  }: TileCardProps) => {
    const isOutlined = variant === 'outlined' && size !== 'lg';
    const isClickable = !!onDoubleClick;

    const tileContentStyle = useMemo(
      () => getTileContentStyles(headless, size, scrollEnabled),
      [headless, size, scrollEnabled],
    );
    const baseTileStyle = useMemo(() => {
      const baseSx = getTileStyles(isHighlighted, headless, size, isOutlined, isClickable);
      return sx ? mergeSx(baseSx, sx) : baseSx;
    }, [headless, isClickable, isHighlighted, isOutlined, size, sx]);

    return (
      <Card
        variant={variant}
        onDoubleClick={onDoubleClick}
        data-testid={getDataTestId(dataTestId, 'Tile')}
        sx={baseTileStyle}
      >
        {!headless && (
          <TileHeader
            title={title}
            dataTestId={getDataTestId(dataTestId, 'TileHeader')}
            subtitle={subtitle}
            titlePostfix={titlePostfix}
            size={size}
            subtitlePostfix={subtitlePostfix}
            actions={actions}
            hasSpot={hasSpot}
          />
        )}
        {alert && <CardContent sx={alertContentStyle}>{alert}</CardContent>}
        {children && <CardContent sx={tileContentStyle}>{children}</CardContent>}
      </Card>
    );
  },
);

TileCard.displayName = 'TileCard';
