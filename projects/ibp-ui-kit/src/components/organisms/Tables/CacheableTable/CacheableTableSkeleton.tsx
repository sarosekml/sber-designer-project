import React, { memo } from 'react';

import { Skeleton, SxBox } from '@/components/atoms';
import { Sx } from '@/utils';

const tableSkeletonSx: Sx = {
  width: '100%',
  '& .dmb-uikit-MuiSkeleton-root': {
    transform: 'none',
    width: '100%',
  },
};

interface Props {
  tableCode?: string;
}

export const TableSkeleton = memo(({ tableCode = 'unknown_table' }: Props) => {
  return (
    <SxBox sx={tableSkeletonSx}>
      <Skeleton dataTestId={`${tableCode}_skeleton`} height={200} />
    </SxBox>
  );
});

TableSkeleton.displayName = 'TableSkeleton';
