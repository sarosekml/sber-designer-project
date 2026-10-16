import { useMemo } from 'react';

import { Sx } from '@/utils';

export const getRootSx = (hasTabs: boolean, minHeight: number | undefined, maxHeight: number | undefined): Sx =>
  useMemo(
    () => (theme) => ({
      maxHeight: maxHeight ?? '100%',
      minHeight: minHeight,
      mt: 0,
      pl: 6,
      pt: 4,
      pr: 6,
      pb: 8,
      overflow: 'auto',
      borderLeft: hasTabs ? `1px solid ${theme.palette.Border.BorderLight}` : 'none',
    }),
    [hasTabs, minHeight, maxHeight],
  );

export const getTabsSx = (minHeight: number | undefined, maxHeight: number | undefined): Sx =>
  useMemo(
    () => ({
      maxHeight: maxHeight ?? '100%',
      minHeight: minHeight,
      pt: 4,
      overflow: 'auto',
    }),
    [minHeight, maxHeight],
  );

export const constructorRootSx: Sx = {
  mt: 0,
  height: '100%',
};
