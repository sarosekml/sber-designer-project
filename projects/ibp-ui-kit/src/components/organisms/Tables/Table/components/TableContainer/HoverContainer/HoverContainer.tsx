import React, { memo, useCallback, useState } from 'react';

import { useDebouncedCallback, useEventApiListener } from '@sber-ibp/core';

import { SxBox } from '@/components/atoms';

import { HoveredRowData, makeRowHoverEventChannel, RowEvents } from '../../TableRow';

import { hoverContainerLeftSx, hoverContainerRightSx, useHoverRootSx } from './HoverContainer.styles';
import { HoverBox, HoverContainerProps } from './HoverContainer.types';

const KEEP_VISIBLE_TIME = 10;

export const HoverContainer = memo(({ render: renderHover, tableCode, stickTo }: HoverContainerProps) => {
  const [hoverBox, setHoverBox] = useState<HoverBox | null>(null);
  const [hoveredRow, setHoveredRow] = useState<HoveredRowData | null>(null);
  const rootSx = useHoverRootSx(hoverBox, stickTo);

  /**
   * When we hover exactly the hover component (not the TableRow itself)
   * we got onMouseLeave event fired for the row component, because the
   * hover is neither child, neither parent component for the row,
   * so we mark the hoverBox isHovered = false, but not delete it completely.
   * Then after the timer is finished if the component is still not hovered via onMouseHover event
   * from TableRow or from HoverContainer we delete it completely.
   */
  const [blurredRow, _setBlurredRow] = useState<string | null>(null);
  const setBlurredRow = useDebouncedCallback((value) => _setBlurredRow(value), [], KEEP_VISIBLE_TIME);

  useEventApiListener<RowEvents>(
    (event) => {
      switch (event.eventId) {
        case 'hover':
          if (hoveredRow?.key !== event.data.key || blurredRow) {
            hoveredRow?.setForceHovered(false);
            setHoveredRow(event.data);
            const target = event.data.ref;
            setHoverBox({
              x: target.offsetLeft,
              y: target.offsetTop,
              width: target.clientWidth,
              height: target.clientHeight,
            });
          }
          void setBlurredRow(null);
          return;
        case 'blur':
          if (hoveredRow?.key === event.data) {
            void setBlurredRow(event.data);
          }
          return;
        case 'resize':
          if (hoveredRow) {
            const target = hoveredRow.ref;
            setHoverBox({
              x: target.offsetLeft,
              y: target.offsetTop,
              width: target.clientWidth,
              height: target.clientHeight,
            });
          }
          return;
        default:
          return;
      }
    },
    [blurredRow, hoveredRow, setBlurredRow],
    makeRowHoverEventChannel(tableCode),
  );

  const onMouseOver = useCallback(() => {
    if (!hoveredRow) return;
    void setBlurredRow(null);
    hoveredRow?.setForceHovered(true);
  }, [hoveredRow, setBlurredRow]);

  const onMouseLeave = useCallback(() => {
    if (!hoveredRow) return;
    void setBlurredRow(hoveredRow.key);
    hoveredRow?.setForceHovered(false);
  }, [hoveredRow, setBlurredRow]);

  if (!hoveredRow || blurredRow === hoveredRow.key) {
    return null;
  }

  return (
    <SxBox sx={rootSx}>
      <SxBox
        sx={stickTo === 'left' ? hoverContainerLeftSx : hoverContainerRightSx}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
      >
        {renderHover(hoveredRow.data as never, hoveredRow.index, hoveredRow.colorSchema)}
      </SxBox>
    </SxBox>
  );
});

HoverContainer.displayName = 'HoverContainer';
