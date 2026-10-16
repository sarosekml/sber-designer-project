import React from 'react';
import { Card as MuiCard, CardActions, CardContent, CardHeader, useTheme } from '@mui/material';

import { Grid } from '@/components/atoms/gridTiles';
import { Text } from '@/components/atoms/typography';
import { getDataTestId } from '@/utils';

import { actionsStyle, bodyStyle, cardStyles, headerIconStyle, headerStyle } from './Card.styles';
import { PropTypes } from './Card.types';

export const BaseCard = React.memo<PropTypes>(
  ({
    actions,
    onClick,
    onDoubleClick,
    children,
    title,
    extra,
    dataTestId,
    selected,
    disabled,
    subtitle,
    headerIcon,
  }) => {
    const theme = useTheme();
    const getCardStyles = cardStyles({ selected, disabled });

    return (
      <MuiCard
        data-testid={getDataTestId(dataTestId, 'Card')}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        sx={getCardStyles}
      >
        {(!!title || !!extra) && (
          <CardHeader
            title={
              <Grid container flexWrap={'nowrap'}>
                {headerIcon ? (
                  <>
                    <Grid container item sx={headerIconStyle}>
                      {headerIcon}
                    </Grid>
                    <Grid container flexDirection={'column'}>
                      <Text dataTestId={getDataTestId(dataTestId, 'CardTitle')} type={'H5StrongSmb'}>
                        {title}
                      </Text>
                      <Text
                        type={'BodyXSReg'}
                        color={theme.palette.Text.TextInactive}
                        dataTestId={getDataTestId(dataTestId, 'Subtitle')}
                      >
                        {subtitle}
                      </Text>
                    </Grid>
                  </>
                ) : (
                  <Text dataTestId={getDataTestId(dataTestId, 'CardTitle')} type={'H5StrongSmb'}>
                    {title}
                  </Text>
                )}
              </Grid>
            }
            sx={headerStyle}
            subheader={
              subtitle &&
              !headerIcon && (
                <Grid container>
                  <Grid item>
                    <Text
                      type={'BodyXSReg'}
                      color={theme.palette.Text.TextInactive}
                      dataTestId={getDataTestId(dataTestId, 'Subtitle')}
                    >
                      {subtitle}
                    </Text>
                  </Grid>
                </Grid>
              )
            }
            action={extra}
          />
        )}
        <CardContent sx={bodyStyle}>{children}</CardContent>
        {actions && (
          <CardActions sx={actionsStyle} data-testid="Actions">
            {actions}
          </CardActions>
        )}
      </MuiCard>
    );
  },
);
