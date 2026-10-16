import { theme } from '@/styles';
import { Sx } from '@/utils';

import { TileSize } from '../TilesTypes';

export const useTileHeaderStyles: (size: TileSize) => Sx = (size) => ({
  padding: () => {
    if (size === 'sm') return theme.spacing(4, 4, 2, 4);
    if (size === 'md') return theme.spacing(5, 5, 2.5, 5);
    return theme.spacing(6, 6, 3, 6);
  },
  '& .dmb-uikit-MuiCardHeader-action': {
    minWidth: '10%',
    margin: 0,
  },
});
