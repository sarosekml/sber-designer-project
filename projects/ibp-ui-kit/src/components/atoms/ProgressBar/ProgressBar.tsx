import React, { memo } from 'react';
import LinearProgress from '@mui/material/LinearProgress';
import {
  getIndicatorStyles,
  indicatorRootStyles,
  linearProgressRootStyles,
  linearProgressStyles,
  progressBarLabelStyles,
} from './ProgressBar.styles';
import { ProgressBarProps } from './ProgressBar.types';
import { SxBox } from '../SxBox';
import { Text } from '../typography/Text';

export const ProgressBar = memo(({ label = '', value = 0, dataTestId }: ProgressBarProps) => {
  const testId = `${dataTestId}_ProgressBar`;
  return (
    <SxBox>
      <SxBox sx={indicatorRootStyles}>
        <Text dataTestId={testId} sx={getIndicatorStyles(value)}>{`${Math.round(value)}%`}</Text>
      </SxBox>
      <SxBox sx={linearProgressRootStyles}>
        <SxBox sx={linearProgressStyles}>
          <LinearProgress variant="determinate" value={value} />
        </SxBox>
      </SxBox>
      {label && (
        <Text dataTestId={`${testId}_Label`} type={'BodyXSExtensive'} sx={progressBarLabelStyles}>
          {label}
        </Text>
      )}
    </SxBox>
  );
});

ProgressBar.displayName = 'ProgressBar';
