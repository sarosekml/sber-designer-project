import { mergeSx, Sx } from '@/utils';

import { TileSize } from '../../TilesTypes';

const getPaddingBottom = (headless: boolean, size: TileSize) => {
  if (headless) return 8;
  if (size === 'lg') return 8;
  if (size === 'md') return 6;
  return 4;
};

export const getTileStyles = (
  isHighlighted: boolean,
  headless: boolean,
  size: TileSize,
  isOutlined: boolean,
  isClickable?: boolean,
) => {
  const baseTileStyle: Sx = {
    display: 'flex',
    flexDirection: 'column',
    pb: getPaddingBottom(headless, size),
    cursor: isClickable ? 'pointer' : 'default',
    height: '100%',
    width: '100%',
    borderRadius: 2,
  };
  const outlinedTileStyle: Sx = (theme) => {
    return {
      border: `1px solid ${theme.palette.Border.BorderPrimary}`,

      ...(isHighlighted
        ? {
            backgroundColor: theme.palette.Primary.PrimaryBG,
            borderColor: theme.palette.Primary.Primary,
          }
        : null),
    };
  };

  const elevationTileStyle: Sx = {
    boxShadow: `none`,
  };

  return mergeSx(baseTileStyle, isOutlined ? outlinedTileStyle : elevationTileStyle);
};

export const alertContentStyle: Sx = {
  padding: 0,
};

export const getTileContentStyles = (headless: boolean, size: TileSize, scrollEnabled: boolean): Sx => ({
  padding: (theme) => {
    if (headless) return theme.spacing(6, 6, 8);
    if (size === 'lg') return theme.spacing(3, 6, 8);
    if (size === 'md') return theme.spacing(2.5, 5, 6);
    return theme.spacing(1, 4, 4);
  },
  '&:last-child': {
    paddingBottom: 0,
  },
  flexGrow: 1,
  ...(scrollEnabled
    ? {
        overflowX: 'scroll',
      }
    : null),
});
