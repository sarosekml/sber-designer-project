import { useMemo } from 'react';

import { Sx } from '@/utils';

import { HoverStickOrientation } from '../../../TableProps';

import { HoverBox } from './HoverContainer.types';

export const useHoverRootSx = (hoverBox: HoverBox | null, orientation: HoverStickOrientation | undefined): Sx =>
  useMemo(
    () => ({
      zIndex: 100,
      position: 'absolute',
      top: hoverBox?.y,
      left: hoverBox?.x,
      width: hoverBox?.width,
      height: hoverBox?.height,
      display: 'flex',
      justifyContent: orientation === 'left' ? 'flex-start' : 'flex-end',
      pointerEvents: 'none',
    }),
    [orientation, hoverBox],
  );

export const hoverContainerRightSx = {
  zIndex: 100,
  position: 'sticky',
  right: 0,
  height: '100%',
  pointerEvents: 'all',
};

export const hoverContainerLeftSx = {
  zIndex: 100,
  position: 'sticky',
  left: 0,
  height: '100%',
  pointerEvents: 'all',
};
