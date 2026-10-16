import React from 'react';
import { Grid, useTheme } from '@mui/material';

import { Avatar, Text } from '@/components/atoms';
import { SxBox } from '@/components/atoms/SxBox';
import { mergeSx } from '@/utils';

import { Badges } from './Badges';
import { containerStyles, leftContainerStyles, textContainerStyles } from './Entity.styles';
import { EntityProps } from './Entity.types';
import { getMainTextSize } from './Entity.utils';
import { SubHeader } from './SubHeader';

export const Entity = ({
  size = 'lg',
  sx,
  avatar = { variant: 'rounded' },
  extra,
  header,
  text,
  prefixText,
  postfixText,
  subHeader,
  subHeaderPrefix,
  badges,
  dataTestId,
  icons,
}: EntityProps) => {
  const theme = useTheme();

  return (
    <SxBox data-testid={dataTestId} sx={mergeSx(containerStyles, sx)}>
      <SxBox sx={leftContainerStyles(size)}>
        <Avatar {...avatar} size={size}>
          {avatar?.icon}
        </Avatar>
        <SxBox sx={textContainerStyles(size)}>
          {header && (
            <Text type="BodyXSReg" color={theme.palette.Text.TextSecondary}>
              {header}
            </Text>
          )}
          {(prefixText || postfixText || text) && (
            <Grid container gap={2}>
              {prefixText && (
                <Text type={getMainTextSize(size)} color={theme.palette.Text.TextSecondary}>
                  {prefixText}
                </Text>
              )}

              {text && (
                <Text type={getMainTextSize(size)} color={theme.palette.Text.TextPrimary}>
                  {text}
                </Text>
              )}

              {postfixText && (
                <Text type={getMainTextSize(size)} color={theme.palette.Text.TextSecondary}>
                  {postfixText}
                </Text>
              )}
            </Grid>
          )}
          {subHeader && <SubHeader subHeader={subHeader} size={size} subHeaderPrefix={subHeaderPrefix} />}
          {badges && <Badges badges={badges} size={size} />}
          <Grid gap={3} container>
            {icons}
          </Grid>
        </SxBox>
      </SxBox>
      {extra && (
        <SxBox>
          <Grid container gap={2} wrap="nowrap">
            {extra}
          </Grid>
        </SxBox>
      )}
    </SxBox>
  );
};
