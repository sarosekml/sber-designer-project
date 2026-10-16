import { CSSProperties, ReactNode } from 'react';
import { GridDirection, GridSpacing } from '@mui/material';

import { DataTestIdProps, GridSizes } from '@/types';

type CommonPositionType = 'center' | 'flex-start' | 'flex-end';
type SpaceType = 'space-between' | 'space-around';

export interface GridTileContainerProps extends DataTestIdProps {
  alignContent?: CSSProperties['alignContent'];
  alignItems?: CSSProperties['alignItems'];
  justify?: CommonPositionType | SpaceType | 'space-evenly';
  className?: string;
  direction?: GridDirection;
  sizes?: GridSizes;
  spacing?: GridSpacing;
  stretchAll?: boolean;
  children?: ReactNode;
}
export interface GridTileStylesProps {
  stretchAll?: boolean;
}
