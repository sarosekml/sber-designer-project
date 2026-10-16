import React, { FC, memo } from 'react';
import { useTheme } from '@mui/material';

import { Text } from '@/components/atoms/typography';
import { getDataTestId } from '@/utils';

import { Grid } from '../Grid';
import { GridTileContainer } from '../GridTileContainer';

import { GridTileSectionProps } from './GridTileSection.types';

/**
 * Grid wrapper with title
 */
export const GridTileSection: FC<GridTileSectionProps> = memo(
  ({ id, title, stretchAll = true, sizes, children, dataTestId, textType = 'H5Reg', textColor, sx, spacing = 2 }) => {
    const theme = useTheme();

    return (
      <Grid
        item
        sizes={sizes}
        alignContent={'flex-start'}
        id={id}
        data-testid={getDataTestId(dataTestId, 'GridTileSection')}
        sx={sx ?? { mt: 4 }}
      >
        {!!title && (
          <Text
            type={textType}
            color={textColor ?? theme.palette.Status.SGreyLight}
            dataTestId={getDataTestId(dataTestId, 'GridTileSection')}
          >
            {title}
          </Text>
        )}
        <GridTileContainer
          spacing={spacing}
          stretchAll={stretchAll}
          dataTestId={getDataTestId(dataTestId, 'GridTileSection')}
        >
          {children}
        </GridTileContainer>
      </Grid>
    );
  },
);
