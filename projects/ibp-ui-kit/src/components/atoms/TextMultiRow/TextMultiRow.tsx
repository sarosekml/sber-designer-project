/* eslint-disable react/jsx-no-useless-fragment */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

import { Grid } from '@/components/atoms/gridTiles';
import { mergeSx } from '@/utils/mergeSx';

import { SxBox } from '../SxBox';
import { Tooltip } from '../Tooltip';

import { getStyles } from './TextMultiRow.styles';
import { TextMultiRowProps } from './TextMultiRow.types';

export const TextMultiRow = memo(
  ({
    text = '',
    children = '',
    lineClamp = 2,
    noTooltip,
    trimmingLength = 200,
    dataTestId,
    enterDelay = 1000,
    size,
    tooltipType = 'default',
    whiteSpace,
    sx
  }: TextMultiRowProps) => {
    const ref = useRef<HTMLDivElement>(null);

    const [height, setHeight] = useState(0);
    const [isEllipsisActive, setIsEllipsisActive] = useState(true);

    const calculateLineClamp = (height: number) => {
      const parentElement = ref.current;
      if (!parentElement) return;

      const gridWithText = parentElement.querySelector('.dmb-uikit-MuiGrid-root');
      if (!gridWithText) return;

      const lineHeight = window.getComputedStyle(gridWithText, null).getPropertyValue('line-height');

      return Math.floor(height / parseInt(lineHeight));
    };

    const baseSx = useMemo(
      () => getStyles(lineClamp !== 'auto' ? lineClamp : calculateLineClamp(height), size, whiteSpace),
      [lineClamp, height, size, whiteSpace],
    );

    useEffect(() => {
      const currentRef = ref.current;
      const resize = new ResizeObserver((entries) => {
        setHeight(entries[0].contentRect.height);

        const textElement = entries[0].target.children[0] as HTMLDivElement;
        setIsEllipsisActive(textElement.offsetHeight < textElement.scrollHeight);
      });
      if (currentRef) resize.observe(currentRef);

      return () => {
        if (currentRef) resize.unobserve(currentRef);
      };
    }, []);

    return (
      <SxBox ref={ref} sx={{ height: '100%' }}>
        <Grid sx={mergeSx(baseSx, sx)}>
          {noTooltip || !isEllipsisActive ? (
            children || text
          ) : (
            <Tooltip
              dataTestId={dataTestId ?? 'Multirow-Tooltip'}
              title={children || text}
              type={tooltipType}
              trimmingLength={trimmingLength}
              enterDelay={enterDelay}
            >
              <>{children || text}</>
            </Tooltip>
          )}
        </Grid>
      </SxBox>
    );
  },
);

TextMultiRow.displayName = 'TextMultiRow';
