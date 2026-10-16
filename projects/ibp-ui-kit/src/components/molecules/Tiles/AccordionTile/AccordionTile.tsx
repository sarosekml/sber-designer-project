import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, Collapse, useTheme } from '@mui/material';

import { Grid } from '@/components/atoms';
import { IconButton } from '@/components/atoms/IconButton';
import { TileHeader } from '@/components/molecules/Tiles/TileHeader';
import { getDataTestId } from '@/utils';

import { AccordionTileProps } from '../TilesTypes';

import { accordionTileStyles, getAccordionContentStyles, getAccordionSummaryStyles } from './AccordionTile.styles';

export const AccordionTile = React.memo<AccordionTileProps>(
  ({
    title,
    subtitle,
    dataTestId,
    titlePostfix,
    subtitlePostfix,
    actions,
    alert,
    accordionSummary,
    accordionContent,
    isExpanded = false,
    disabled = false,
    size = 'md',
    gridSizes = { xs: 12 },
    hasSpot,
    isDragAndDropContainer = false,
    dragAndDropContainerState = undefined,
    onExpand,
  }) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(isExpanded);
    const handleCollapse = useCallback(
      () =>
        setExpanded((prev) => {
          onExpand?.(!prev);
          return !prev;
        }),
      [],
    );
    const accordionSummaryStyle = useMemo(() => getAccordionSummaryStyles(size, expanded), [size, expanded]);
    const accordionContentStyle = useMemo(() => getAccordionContentStyles(size), [size]);
    const { disabledStyle, borderedStyle, alertStyle, sizeLStyle } = accordionTileStyles(
      theme,
      size,
      isDragAndDropContainer,
      dragAndDropContainerState,
    );
    const isAccordionSizeL = size === 'lg';
    const cardStyle = [borderedStyle, (disabled && disabledStyle) ?? null];

    useEffect(() => {
      onExpand?.(isExpanded);
      setExpanded(isExpanded);
    }, [isExpanded]);

    return (
      <Grid item sizes={gridSizes} data-testid={getDataTestId(dataTestId, 'AccordionTileGrid')}>
        <Card data-testid={getDataTestId(dataTestId, 'AccordionTile')} sx={isAccordionSizeL ? sizeLStyle : cardStyle}>
          <TileHeader
            title={title}
            dataTestId={getDataTestId(dataTestId, 'TileHeader')}
            subtitle={subtitle}
            titlePostfix={titlePostfix}
            size={size}
            subtitlePostfix={subtitlePostfix}
            hasSpot={hasSpot}
            actions={
              <>
                {actions}
                {accordionContent ? (
                  <IconButton
                    name={expanded ? 'ChevronUp' : 'ChevronDown'}
                    dataTestId={getDataTestId(dataTestId, 'CollapseIcon')}
                    size={'lg'}
                    onClick={handleCollapse}
                  />
                ) : null}
              </>
            }
          />
          {alert && <CardContent sx={alertStyle}>{alert}</CardContent>}
          {accordionSummary && <CardContent sx={accordionSummaryStyle}>{accordionSummary}</CardContent>}
          {accordionContent && (
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <CardContent sx={accordionContentStyle}>{accordionContent}</CardContent>
            </Collapse>
          )}
        </Card>
      </Grid>
    );
  },
);

AccordionTile.displayName = 'AccordionTile';
