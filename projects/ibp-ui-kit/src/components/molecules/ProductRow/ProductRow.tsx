import React from 'react';
import { useTheme } from '@mui/material';

import { Grid } from '@/components/atoms';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/typography/Text';
import { getDataTestId } from '@/utils';

import { IdentData } from './IdentData';
import {
  actionsStyles,
  subTitleIconStyles,
  titleContainerStyles,
  titlePostfixStyles,
  titlePrefixStyles,
  titleStyles,
  useRootStyles,
} from './ProductRow.styles';
import { ProductRowProps } from './ProductRows.types';

export const ProductRow = ({
  title,
  subtitle,
  titlePostfix,
  titlePrefix,
  actions,
  dataTestId,
  variant = 'bordered',
  disabled,
  highlight,
  active,
  error,
  buttonLabel,
  hasSpot,
  onDoubleClick,
  onClick,
  identData,
}: ProductRowProps) => {
  const rootStyles = useRootStyles({ disabled, variant, error, buttonLabel, highlight, active });
  const isFlatStyle = variant === 'flat';
  const isTransparentStyle = variant === 'transparent';
  const theme = useTheme();

  return (
    <Grid
      item
      container
      sx={rootStyles}
      onClick={disabled ? undefined : onClick}
      onDoubleClick={disabled ? undefined : onDoubleClick}
    >
      <Grid item container rowGap={1}>
        <Grid item container gap={4} flexWrap="nowrap">
          <Grid item container sx={titleContainerStyles}>
            {!!titlePrefix && (
              <Grid item sx={titlePrefixStyles}>
                {titlePrefix}
              </Grid>
            )}
            <Grid item container sx={titleStyles} columnGap={hasSpot ? 1 : 0}>
              <Grid item>
                <Text
                  dataTestId={getDataTestId(dataTestId, 'title')}
                  type={isFlatStyle || isTransparentStyle ? 'BodyLStrongSmb' : 'BodyLReg'}
                  color={theme.palette.Text.TextPrimary}
                >
                  {title}
                </Text>
              </Grid>
              {hasSpot && (
                <Grid item>
                  <Icon name={'Modify'} size={'lg'} color={theme.palette.Warning.Warning} />
                </Grid>
              )}
            </Grid>

            {!!titlePostfix && (
              <Grid item sx={titlePostfixStyles}>
                {titlePostfix}
              </Grid>
            )}
          </Grid>
          <Grid item container sx={actionsStyles}>
            {actions}
          </Grid>
        </Grid>

        {subtitle && (
          <Grid item container>
            <Icon sx={subTitleIconStyles} name={'CheckCircleFilled'} dataTestId={'subtitle'} />
            <Text
              type="BodyXSReg"
              dataTestId={getDataTestId(dataTestId, 'subTitle')}
              color={theme.palette.Text.TextInactive}
            >
              {subtitle}
            </Text>
          </Grid>
        )}

        {!!identData && <IdentData disabled={disabled} identData={identData} />}
      </Grid>
    </Grid>
  );
};
