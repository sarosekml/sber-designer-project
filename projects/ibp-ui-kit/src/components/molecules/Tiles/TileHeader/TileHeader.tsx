import React, { useMemo } from 'react';
import { CardHeader, useTheme } from '@mui/material';

import { Grid, Icon } from '@/components/atoms';
import { Text } from '@/components/atoms/typography';
import { getDataTestId } from '@/utils';

import { TileHeaderProps } from '../TilesTypes';

import { useTileHeaderStyles } from './TileHeader.styles';

export const TileHeader = React.memo<TileHeaderProps>(
  ({ title, subtitle, titlePostfix, subtitlePostfix, actions, size, dataTestId, hasSpot }) => {
    const theme = useTheme();
    const styles = useTileHeaderStyles(size);
    const textType = useMemo(() => {
      if (size === 'lg') return 'H4StrongSmb';
      if (size === 'md') return 'BodyLStrongSmb';
      if (size === 'sm') return 'H5StrongSmb';
      return 'H6StrongSmb';
    }, [size]);

    return (
      <CardHeader
        sx={styles}
        action={
          <Grid item container justifyContent={'flex-end'} columnGap={2}>
            {actions}
          </Grid>
        }
        data-testid={dataTestId}
        title={
          <Grid container wrap={'nowrap'} columnGap={2} justifyContent={'flex-start'} alignItems={'baseline'}>
            {title && (
              <Grid item container sx={hasSpot ? { columnGap: 1, flexWrap: 'nowrap' } : undefined} width={'auto'}>
                <Text
                  type={textType}
                  dataTestId={getDataTestId(dataTestId, 'Title')}
                  style={hasSpot ? { lineHeight: theme.spacing(7.5) } : undefined}
                  color={theme.palette.Text.TextPrimary}
                >
                  {title}
                </Text>
                {hasSpot && <Icon name={'Modify'} size={'lg'} color={theme.palette.Warning.Warning} />}
              </Grid>
            )}
            {titlePostfix && (
              <Grid item width={'auto'}>
                {titlePostfix}
              </Grid>
            )}
          </Grid>
        }
        subheader={
          subtitle || subtitlePostfix ? (
            <Grid container direction={'column'} pt={2}>
              {subtitle && (
                <Grid item mt={1}>
                  <Text
                    type={'BodyXSReg'}
                    color={theme.palette.Text.TextInactive}
                    dataTestId={getDataTestId(dataTestId, 'Subtitle')}
                  >
                    {subtitle}
                  </Text>
                </Grid>
              )}
              {subtitlePostfix && (
                <Grid item container>
                  {subtitlePostfix}
                </Grid>
              )}
            </Grid>
          ) : null
        }
      />
    );
  },
);

TileHeader.displayName = 'TileHeader';
