import React, { useMemo } from 'react';
import { useTheme } from '@mui/material';

import { dashSymbol, reverseIsoDate } from '@sber-ibp/core';

import { Grid } from '@/components/atoms';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/typography/Text';
import { InputNumber } from '@/components/molecules/Inputs';

import { Tooltip } from '../../atoms/Tooltip';

import { IdentData as IdentDataType } from './ProductRows.types';

interface Props {
  disabled?: boolean;
  identData?: IdentDataType;
}

export const IdentData = ({ disabled, identData }: Props) => {
  const theme = useTheme();

  const color = useMemo(() => {
    return disabled ? theme.palette.Text.TextInactive : theme.palette.Text.TextSecondary;
  }, [disabled, theme]);

  return (
    <Grid item container columnGap={3} rowGap={1} alignItems="center">
      <Grid item alignItems="center">
        <Grid container gap={2} alignItems="center" minWidth={114} flexWrap="nowrap">
          <Grid item alignItems="center">
            <Tooltip type="hint" title={identData?.dateTooltip} disabled={!identData?.dateTooltip}>
              <Icon color={disabled ? 'disabled' : 'secondary'} name={'Calendar'} />
            </Tooltip>
          </Grid>
          <Text color={color}>{identData?.date ? reverseIsoDate(identData?.date) : dashSymbol}</Text>
        </Grid>
      </Grid>
      <Grid item alignItems="center">
        <Grid container gap={2} alignItems="center" flexWrap="nowrap">
          <Grid item alignItems="center">
            <Tooltip type="hint" title={identData?.amountTooltip} disabled={!identData?.amountTooltip}>
              <Icon color={disabled ? 'disabled' : 'secondary'} name={'BarChartSquare'} />
            </Tooltip>
          </Grid>
          <Grid item alignItems="center">
            {identData?.amount != null ? (
              <InputNumber
                textColor={color}
                value={Number(identData?.amount)}
                viewType="read"
                postfix={identData?.currency}
              />
            ) : (
              <Text color={color}>{dashSymbol}</Text>
            )}
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};
