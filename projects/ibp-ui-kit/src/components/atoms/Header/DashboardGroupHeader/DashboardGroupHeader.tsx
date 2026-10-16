import React from 'react';

import { Grid } from '@/components/atoms';

import { SxBox } from '../../SxBox';
import { Text } from '../../typography';

import { useDashboardGroupHeaderStyles } from './DashboardGroupHeader.styles';
import { DashboardGroupHeaderProps } from './DashboardGroupHeader.types';

export const DashboardGroupHeader = ({ children, dataTestId, sx }: DashboardGroupHeaderProps) => {
  const className = 'dmb-uikit-DashboardGroupHeader';
  const styles = useDashboardGroupHeaderStyles(sx);
  return (
    <Grid
      container
      className={className}
      sx={styles}
      flexDirection={'row'}
      alignItems={'center'}
      dataTestId={`DashboardGroupHeader_${dataTestId}`}
    >
      <Text type="BodySReg" dataTestId={`DashboardGroupHeader_${dataTestId}`}>
        {children}
      </Text>
      <SxBox className={`${className}-Line`} />
    </Grid>
  );
};
