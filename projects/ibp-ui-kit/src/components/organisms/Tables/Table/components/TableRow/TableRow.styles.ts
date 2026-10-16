import { useMemo } from 'react';

import { Sx } from '@/utils';

import { TableColorSchema } from '../../TableProps';

interface Props {
  isSelectable: boolean;
  isSelectedRow: boolean;
  isHidden: boolean;
  colorSchema: TableColorSchema | undefined;
  forceHover?: boolean;
}

export const useRowStyles = ({ isSelectable, isSelectedRow, isHidden, colorSchema, forceHover }: Props): Sx =>
  useMemo(() => {
    let backgroundColor = isSelectedRow && isSelectable ? colorSchema?.focus : colorSchema?.default;
    if (forceHover) {
      backgroundColor = colorSchema?.hover;
    }

    return {
      cursor: !isHidden && isSelectable ? 'pointer' : '',
      display: isHidden ? 'none' : undefined,
      '&: hover': {
        backgroundColor: colorSchema?.hover,
      },
      backgroundColor,
    };
  }, [colorSchema, forceHover, isHidden, isSelectable, isSelectedRow]);
