import React, { memo } from 'react';
import { Skeleton as MaterialSkeleton } from '@mui/material';

import { theme } from '@/styles';
import { getDataTestId } from '@/utils';

import { SkeletonProps } from './Skeleton.types';

/** @todo Not sure, that need to use theme object as default value like here, need to think about more correct solution */
export const Skeleton = memo(({ variant, width, height = theme.spacing(16), animation, dataTestId }: SkeletonProps) => {
  return (
    <MaterialSkeleton
      data-testid={getDataTestId(dataTestId, 'Skeleton')}
      variant={variant}
      width={width}
      height={height}
      animation={animation}
    />
  );
});

Skeleton.displayName = 'Skeleton';
