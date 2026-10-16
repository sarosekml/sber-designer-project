import { useCallback, useMemo } from 'react';

import { Sx } from '@/utils';

import { HoverStickOrientation, TableColorSchema, useTableColorSchema } from '../Table';

const fadeWidth = 20;
const prepareAlfaGradient = (color: string, fadeWidth: string, orientation: HoverStickOrientation) =>
  `linear-gradient(to ${orientation}, #0000 0px, ${color} ${fadeWidth}, ${color} 100%)`;

export const useHoverTableTemplateSx = (
  schema: TableColorSchema | undefined,
  orientation: HoverStickOrientation = 'right',
): Sx => {
  const defaultColorSchema = useTableColorSchema();
  return useCallback(
    (theme) => ({
      background: prepareAlfaGradient(schema?.hover ?? defaultColorSchema.hover, theme.spacing(fadeWidth), orientation),
      height: '100%',
      [orientation === 'right' ? 'paddingLeft' : 'paddingRight']: fadeWidth,
    }),
    [defaultColorSchema, orientation, schema],
  );
};

export const hoverTableSx: Sx = (theme) => ({
  display: 'flex',
  alignItems: 'center',
  height: `100%`,
  gap: theme.spacing(4),
  pr: theme.spacing(4),
  pl: theme.spacing(4),
});

export const hoverMenuItemSx: Sx = {
  '& .dmb-uikit-MuiBox-root': {
    width: 'inherit',
    height: 'inherit',
    '& .dmb-uikit-MuiButtonBase-root': {
      width: 'inherit',
      height: 'inherit',
    },
  },
};
