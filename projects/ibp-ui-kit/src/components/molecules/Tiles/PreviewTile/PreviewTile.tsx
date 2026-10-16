import React, { useMemo } from 'react';

import { mergeSx } from '@/utils';

import { IconButton } from '../../../atoms';
import { Tile } from '../Tile';
import { TileProps } from '../TilesTypes';

import { previewTileSx } from './PreviewTile.styles';

const ROOT = 'PreviewTile';

export interface PreviewTileProps extends TileProps {
  onClose?: () => void;
}

export const PreviewTile = React.memo(({ sx, actions, onClose, ...props }: PreviewTileProps) => {
  const tileSx = useMemo(() => (sx ? mergeSx(sx, previewTileSx) : previewTileSx), [sx]);

  return (
    <Tile
      {...props}
      sx={tileSx}
      actions={
        <React.Fragment>
          {actions}
          {onClose ? (
            <IconButton size={'md'} onClick={onClose} dataTestId={`${ROOT}CloseOpportunityInfo`} name={'Close'} />
          ) : (
            onClose
          )}
        </React.Fragment>
      }
    />
  );
});

PreviewTile.displayName = 'PreviewTile';
