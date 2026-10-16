import { Sx } from '@/utils';

import { GridTileStylesProps } from './GridTileContainer.types';

export const getGridStyles = ({ stretchAll }: GridTileStylesProps): Sx => ({
  marginTop: 0,
  height: 'fit-content',
  '& > .MuiGrid-item > *': {
    ...(stretchAll && { height: '100%' }),
  },
});
