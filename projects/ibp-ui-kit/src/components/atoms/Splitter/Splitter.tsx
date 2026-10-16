import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid } from '@mui/material';

import { Icon } from '../Icon';
import { SxBox } from '../SxBox';

import { getLeftColumnStyles, getRightColumnStyles, splitterContainerStyles, splitterStyles } from './Splitter.styles';
import { SplitterProps } from './Splitter.types';
import { hideGhostDragImage } from './Splitter.utils';

export const Splitter = memo<SplitterProps>(
  ({ dataTestId, leftColumn, rightColumn, leftColumnWidth = '50%', minColumnWidth = '15%' }) => {
    const rightColumnStyles = useMemo(() => getRightColumnStyles({ minColumnWidth }), [minColumnWidth]);
    const leftColumnStyles = useMemo(
      () => getLeftColumnStyles({ minColumnWidth, leftColumnWidth: rightColumn === null ? '100%' : leftColumnWidth }),
      [minColumnWidth, leftColumnWidth, rightColumn],
    );

    const [initialPos, setInitialPos] = useState(0);
    const [initialSizeLeftColumn, setInitialSizeLeftColumn] = useState(0);
    const splitterRef = useRef<HTMLElement>(null);
    const leftColumnRef = useRef<HTMLElement>(null);
    const rightColumnRef = useRef<HTMLElement>(null);

    const onDragStart = useCallback((event: React.DragEvent<HTMLDivElement>) => {
      const splitter = splitterRef.current as HTMLElement;
      const leftColumnElement = leftColumnRef.current as HTMLElement;

      setInitialPos(event.clientX);
      setInitialSizeLeftColumn(leftColumnElement.offsetWidth);

      hideGhostDragImage(event, splitter);
    }, []);

    const onDrag = useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        const splitter = splitterRef.current as HTMLElement;
        const leftColumnElement = leftColumnRef.current as HTMLElement;
        const rightColumnElement = rightColumnRef.current as HTMLElement;
        const parentElement = splitter.parentElement as HTMLElement;

        const newWidthLeftColumn = initialSizeLeftColumn + (event.clientX - initialPos);
        leftColumnElement?.style?.setProperty('width', `${newWidthLeftColumn}px`);

        const newWidthRightColumn = parentElement.offsetWidth - splitter.offsetWidth - newWidthLeftColumn;
        rightColumnElement?.style?.setProperty('width', `${newWidthRightColumn}px`);
      },
      [initialPos, initialSizeLeftColumn],
    );

    const resetColumns = useCallback(() => {
      const leftColumnElement = leftColumnRef.current as HTMLElement;
      const rightColumnElement = rightColumnRef.current as HTMLElement;

      leftColumnElement?.style?.setProperty('width', `${leftColumnWidth}`);
      rightColumnElement?.style?.removeProperty('width');
    }, [leftColumnWidth]);

    useEffect(() => {
      rightColumn === null && leftColumnRef?.current?.style.removeProperty('width');
    }, [rightColumn]);

    return (
      <Grid sx={splitterContainerStyles} data-testid={`SplitterContainer_${dataTestId}`}>
        <SxBox sx={leftColumnStyles} ref={leftColumnRef}>
          {leftColumn}
        </SxBox>
        {rightColumn !== null && (
          <SxBox
            component="div"
            sx={splitterStyles}
            className={'dmb-uikit-Splitter'}
            data-testid={`Splitter_${dataTestId}`}
            draggable
            onDragStart={onDragStart}
            onDrag={onDrag}
            onDoubleClick={resetColumns}
            ref={splitterRef}
          >
            <Icon dataTestId={'SplitterIcon'} name={'MoreDots'} color={'secondary'} />
          </SxBox>
        )}

        {rightColumn !== null && <SxBox sx={rightColumnStyles}>{rightColumn}</SxBox>}
      </Grid>
    );
  },
);
